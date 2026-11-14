import type {
  GenerateContentRequest,
  GenerateContentResult,
  GenerationConfig,
  GenerativeModel,
} from '@google/generative-ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  AIProvider,
  CategoryEvaluation,
  ImportedChargeToMatch,
} from '@/server/services/ai/aiProvider';
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

type AnalysisRequest = {
  expenseSummary: string;
  suffixPrompt: string | undefined;
};

type MatchRequest = {
  importedCharge: ImportedChargeToMatch;
  potentialMatches: Transaction[];
};

type GeminiRequest = {
  text: string;
  systemInstruction?: string;
  generationConfig?: GenerationConfig;
};

export class GeminiService implements AIProvider {
  private errorFallback = new ProviderFallback({
    where: 'Gemini API error',
    modelName: () => this.modelName(),
  });

  private getGemini = lazy(() => new GoogleGenerativeAI(requireEnv('GEMINI_API_KEY')));

  public async generateContent(prompt: string): Promise<string> {
    return this.errorFallback.orFallback({ attempt: this.requestContent(prompt), fallback: '' });
  }

  public async analyzeExpenses(
    expenseSummary: string,
    suffixPrompt?: string,
  ): Promise<string | null> {
    return this.errorFallback.orFallback({
      attempt: this.requestAnalysis({ expenseSummary, suffixPrompt }),
      fallback: null,
    });
  }

  public async suggestCategory(
    expenseDescription: string,
    categoryOptions: Category[],
  ): Promise<string | null> {
    return this.errorFallback.categoryIdOrNull(
      this.evaluateCategory(expenseDescription, categoryOptions),
    );
  }

  public async evaluateCategory(
    expenseDescription: string,
    categoryOptions: Category[],
  ): Promise<CategoryEvaluation> {
    logger.debug({ expenseDescription }, 'Start suggesting category for expense');
    const response = await this.generate({
      text: buildSuggestCategoryPrompt(expenseDescription, categoryOptions),
      systemInstruction: SUGGEST_CATEGORY_SYSTEM_PROMPT,
      generationConfig: { maxOutputTokens: AI_REQUEST_LIMITS.thinkingCategoryMaxOutputTokens },
    });

    const usage = response.response?.usageMetadata;
    const evaluation = buildCategoryEvaluation(this.firstCandidateText(response), categoryOptions, {
      inputTokens: usage?.promptTokenCount ?? null,
      // candidatesTokenCount leaves out the thinking tokens Gemini bills as output.
      outputTokens: usage ? usage.totalTokenCount - usage.promptTokenCount : null,
    });
    logger.debug(
      { expenseDescription, categoryName: evaluation.categoryName },
      'Done suggesting category for expense',
    );
    return evaluation;
  }

  public async findMatchingTransaction(
    importedCharge: ImportedChargeToMatch,
    potentialMatches: Transaction[],
  ): Promise<string | null> {
    logger.debug(
      { importedDescription: importedCharge.description },
      'Start finding matching transaction',
    );
    if (!potentialMatches.length) {
      return null;
    }
    return this.errorFallback.orFallback({
      attempt: this.requestMatch({ importedCharge, potentialMatches }),
      fallback: null,
      where: 'Error finding matching transaction',
    });
  }

  public modelName(): string {
    return optionalEnv('GEMINI_MODEL', DEFAULT_GEMINI_MODEL);
  }

  private async requestContent(prompt: string): Promise<string> {
    logger.debug({ prompt }, 'Start generating content');
    const content = this.firstCandidateText(await this.generate({ text: prompt }));
    logger.debug({ prompt }, 'Done generating content');
    return content || '';
  }

  private async requestAnalysis({
    expenseSummary,
    suffixPrompt,
  }: AnalysisRequest): Promise<string | null> {
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
  }: MatchRequest): Promise<string | null> {
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
    const request: GenerateContentRequest = { contents: [{ role: 'user', parts: [{ text }] }] };
    if (systemInstruction !== undefined) {
      request.systemInstruction = systemInstruction;
    }
    if (generationConfig !== undefined) {
      request.generationConfig = generationConfig;
    }
    return this.generativeModel().generateContent(request);
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
