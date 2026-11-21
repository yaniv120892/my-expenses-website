import OpenAI from 'openai';
import type {
  AIProvider,
  CategoryEvaluation,
  ImportedChargeToMatch,
} from '@/server/services/ai/aiProvider';
import type {
  ExpenseAnalysisRequest,
  TransactionMatchRequest,
} from '@/server/services/ai/providerRequests';
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
  resolveMatchedTransactionId,
  buildCategoryEvaluation,
} from '@/server/services/ai/prompts';
import { ProviderFallback } from '@/server/services/ai/providerFallback';

// Overridable so a retired model is a dashboard edit, not a deploy.
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

// A completion request minus the model, which `complete` always fills from `modelName()`.
type ChatRequest = Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, 'model'>;

export class ChatGPTService implements AIProvider {
  private readonly errorFallback = new ProviderFallback({
    where: 'ChatGPT API error',
    modelName: () => this.modelName(),
  });

  private getOpenAI = lazy(
    () =>
      new OpenAI({
        apiKey: requireEnv('OPENAI_API_KEY'),
        timeout: AI_REQUEST_LIMITS.timeoutMs,
        maxRetries: AI_REQUEST_LIMITS.maxRetries,
      }),
  );

  public async generateContent(prompt: string): Promise<string> {
    return this.errorFallback.orFallback({
      operation: 'generateContent',
      attempt: this.requestContent(prompt),
      fallback: '',
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
    expenseDescription: string,
    categoryOptions: Category[],
  ): Promise<string | null> {
    return this.errorFallback.categoryIdOrNull({
      operation: 'suggestCategory',
      evaluation: this.evaluateCategory(expenseDescription, categoryOptions),
    });
  }

  public async evaluateCategory(
    expenseDescription: string,
    categoryOptions: Category[],
  ): Promise<CategoryEvaluation> {
    const response = await this.complete({
      messages: [
        { role: 'system', content: SUGGEST_CATEGORY_SYSTEM_PROMPT },
        { role: 'user', content: buildSuggestCategoryPrompt(expenseDescription, categoryOptions) },
      ],
      max_tokens: AI_REQUEST_LIMITS.categoryMaxOutputTokens,
    });

    return buildCategoryEvaluation(response.choices[0]?.message?.content, categoryOptions, {
      inputTokens: response.usage?.prompt_tokens ?? null,
      outputTokens: response.usage?.completion_tokens ?? null,
    });
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
    return optionalEnv('OPENAI_MODEL', DEFAULT_OPENAI_MODEL);
  }

  private async requestContent(prompt: string): Promise<string> {
    const response = await this.complete({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
    });
    return this.firstChoiceContent(response) || 'No insights available.';
  }

  private async requestAnalysis({
    expenseSummary,
    suffixPrompt,
  }: ExpenseAnalysisRequest): Promise<string | null> {
    const response = await this.complete({
      messages: [
        {
          role: 'system',
          content: 'You are a financial assistant helping users analyze their expenses.',
        },
        { role: 'user', content: buildAnalyzeExpensesPrompt(expenseSummary, suffixPrompt) },
      ],
      max_tokens: 200,
    });
    return this.firstChoiceContent(response) || null;
  }

  private async requestMatch({
    importedCharge,
    potentialMatches,
  }: TransactionMatchRequest): Promise<string | null> {
    if (!potentialMatches.length) {
      return null;
    }
    const response = await this.complete({
      messages: [
        { role: 'system', content: FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildFindMatchingTransactionPrompt(importedCharge, potentialMatches),
        },
      ],
      temperature: 0,
      max_tokens: 50,
    });
    return resolveMatchedTransactionId(this.firstChoiceContent(response), potentialMatches);
  }

  private async complete(request: ChatRequest): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    return this.getOpenAI().chat.completions.create({ model: this.modelName(), ...request });
  }

  private firstChoiceContent(
    response: OpenAI.Chat.Completions.ChatCompletion,
  ): string | null | undefined {
    const [choice] = response.choices;
    if (!choice) {
      throw new Error(`OpenAI completion ${response.id} returned no choices`);
    }
    return choice.message?.content;
  }
}
