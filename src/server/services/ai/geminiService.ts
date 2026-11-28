import type {
  GenerateContentResult,
  GenerationConfig,
  GenerativeModel,
} from '@google/generative-ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  AIProvider,
  CategorizedRow,
  CategoryEvaluation,
  ImportedChargeToMatch,
} from '@/server/services/ai/aiProvider';
import type {
  ExpenseAnalysisRequest,
  TransactionMatchRequest,
} from '@/server/services/ai/providerRequests';
import { logger } from '@/server/observability';
import type { Category } from '@/shared/types/category';
import type { Transaction } from '@/shared/types/transaction';
import { lazy } from '@/server/lib/lazy';
import { AI_REQUEST_LIMITS } from '@/server/services/ai/requestLimits';
import { optionalEnv, requireEnv } from '@/server/env';
import {
  buildAnalyzeExpensesPrompt,
  buildSuggestCategoryPrompt,
  buildFindMatchingTransactionPrompt,
  FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT,
  SUGGEST_CATEGORY_SYSTEM_PROMPT,
  buildCategoryEvaluation,
  resolveMatchedTransactionId,
} from '@/server/services/ai/prompts';
import { ProviderFallback } from '@/server/services/ai/providerFallback';

// Google retires Flash generations roughly twice a year, so the id is
// overridable: the next retirement is a dashboard edit, not a deploy.
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

type GeminiRequest = {
  text: string;
  systemInstruction?: string;
  generationConfig?: GenerationConfig;
};

export class GeminiService implements AIProvider {
  private readonly errorFallback = new ProviderFallback({
    provider: 'Gemini',
    modelName: () => this.modelName(),
  });

  private getGemini = lazy(() => new GoogleGenerativeAI(requireEnv('GEMINI_API_KEY')));

  public async generateContent(prompt: string): Promise<string | null> {
    return this.errorFallback.orFallback({
      operation: 'generateContent',
      attempt: this.requestContent(prompt),
      fallback: null,
    });
  }

  public async analyzeExpenses(
    expenseSummary: string,
    suffixPrompt?: string,
  ): Promise<string | null> {
    return this.errorFallback.orFallback({
      operation: 'analyzeExpenses',
      attempt: this.requestAnalysis({ expenseSummary, suffixPrompt }),
      fallback: null,
    });
  }

  public async suggestCategory(
    row: CategorizedRow,
    categoryOptions: Category[],
  ): Promise<string | null> {
    return this.errorFallback.categoryIdOrNull({
      operation: 'suggestCategory',
      evaluation: this.evaluateCategory(row, categoryOptions),
    });
  }

  public async evaluateCategory(
    row: CategorizedRow,
    categoryOptions: Category[],
  ): Promise<CategoryEvaluation> {
    logger.debug({ ...row }, 'Start suggesting category');
    const response = await this.generate({
      text: buildSuggestCategoryPrompt(row, categoryOptions),
      systemInstruction: SUGGEST_CATEGORY_SYSTEM_PROMPT,
      generationConfig: { maxOutputTokens: AI_REQUEST_LIMITS.thinkingCategoryMaxOutputTokens },
    });

    const usage = response.response?.usageMetadata;
    const evaluation = buildCategoryEvaluation(this.firstCandidateText(response), categoryOptions, {
      inputTokens: usage?.promptTokenCount ?? null,
      // candidatesTokenCount leaves out the thinking tokens Gemini bills as output.
      outputTokens: usage ? usage.totalTokenCount - usage.promptTokenCount : null,
    });
    logger.debug({ ...row, categoryName: evaluation.categoryName }, 'Done suggesting category');
    return evaluation;
  }

  public async findMatchingTransaction(
    importedCharge: ImportedChargeToMatch,
    potentialMatches: Transaction[],
  ): Promise<string | null> {
    return this.errorFallback.orFallback({
      operation: 'findMatchingTransaction',
      attempt: this.requestMatch({ importedCharge, potentialMatches }),
      fallback: null,
    });
  }

  public modelName(): string {
    return optionalEnv('GEMINI_MODEL', DEFAULT_GEMINI_MODEL);
  }

  private async requestContent(prompt: string): Promise<string | null> {
    logger.debug({ promptLength: prompt.length }, 'Start generating content');
    const content = this.firstCandidateText(await this.generate({ text: prompt }));
    logger.debug({ promptLength: prompt.length }, 'Done generating content');
    return content || null;
  }

  private async requestAnalysis({
    expenseSummary,
    suffixPrompt,
  }: ExpenseAnalysisRequest): Promise<string | null> {
    logger.debug('Start analyzing expenses');
    const response = await this.generate({
      text: buildAnalyzeExpensesPrompt(expenseSummary, suffixPrompt),
    });
    const analysis = this.cleanGeminiResponse(this.firstCandidateText(response));
    logger.debug({ analysis }, 'Done analyzing expenses');
    return analysis || null;
  }

  private async requestMatch({
    importedCharge,
    potentialMatches,
  }: TransactionMatchRequest): Promise<string | null> {
    logger.debug(
      { importedDescription: importedCharge.description },
      'Start finding matching transaction',
    );
    if (!potentialMatches.length) {
      return null;
    }
    const response = await this.generate({
      text: buildFindMatchingTransactionPrompt(importedCharge, potentialMatches),
      systemInstruction: FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT,
      generationConfig: { temperature: 0 },
    });
    const result = resolveMatchedTransactionId(
      this.cleanGeminiResponse(this.firstCandidateText(response)),
      potentialMatches,
    );
    logger.debug({ result }, 'Done finding matching transaction');
    return result;
  }

  private async generate({
    text,
    systemInstruction,
    generationConfig,
  }: GeminiRequest): Promise<GenerateContentResult> {
    // Omitted, not undefined: the SDK spreads the request over the model's defaults, and an
    // undefined key would erase one.
    return this.generativeModel().generateContent({
      ...(systemInstruction !== undefined && { systemInstruction }),
      contents: [{ role: 'user', parts: [{ text }] }],
      ...(generationConfig !== undefined && { generationConfig }),
    });
  }

  private generativeModel(): GenerativeModel {
    return this.getGemini().getGenerativeModel(
      { model: this.modelName() },
      { timeout: AI_REQUEST_LIMITS.timeoutMs },
    );
  }

  private firstCandidateText(result: GenerateContentResult): string | undefined {
    return result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
  }

  private cleanGeminiResponse(response: string | undefined): string {
    if (!response) {
      return '';
    }
    return response
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/\n+/g, '\n')
      .trim();
  }
}
