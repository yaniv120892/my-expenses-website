import OpenAI from 'openai';
import type {
  AIProvider,
  CategoryEvaluation,
  ImportedChargeToMatch,
} from '@/server/services/ai/aiProvider';
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

type ChatRequest = {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  maxTokens: number;
  temperature?: number;
};

export class ChatGPTService implements AIProvider {
  private errorFallback = new ProviderFallback({
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
    return this.errorFallback.orFallback({ attempt: this.requestContent(prompt), fallback: '' });
  }

  public async analyzeExpenses(
    expenseSummary: string,
    suffixPrompt?: string,
  ): Promise<string | null> {
    return this.errorFallback.orFallback({
      attempt: this.requestAnalysis(expenseSummary, suffixPrompt),
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
    const response = await this.complete({
      messages: [
        { role: 'system', content: SUGGEST_CATEGORY_SYSTEM_PROMPT },
        { role: 'user', content: buildSuggestCategoryPrompt(expenseDescription, categoryOptions) },
      ],
      maxTokens: AI_REQUEST_LIMITS.categoryMaxOutputTokens,
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
    if (!potentialMatches.length) {
      return null;
    }
    return this.errorFallback.orFallback({
      attempt: this.requestMatch(importedCharge, potentialMatches),
      fallback: null,
    });
  }

  public modelName(): string {
    return optionalEnv('OPENAI_MODEL', DEFAULT_OPENAI_MODEL);
  }

  private async requestContent(prompt: string): Promise<string> {
    const response = await this.complete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 200,
    });
    return this.firstChoiceContent(response) || 'No insights available.';
  }

  private async requestAnalysis(
    expenseSummary: string,
    suffixPrompt: string | undefined,
  ): Promise<string | null> {
    const response = await this.complete({
      messages: [
        {
          role: 'system',
          content: 'You are a financial assistant helping users analyze their expenses.',
        },
        { role: 'user', content: buildAnalyzeExpensesPrompt(expenseSummary, suffixPrompt) },
      ],
      maxTokens: 200,
    });
    return this.firstChoiceContent(response) || null;
  }

  private async requestMatch(
    importedCharge: ImportedChargeToMatch,
    potentialMatches: Transaction[],
  ): Promise<string | null> {
    const response = await this.complete({
      messages: [
        { role: 'system', content: FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildFindMatchingTransactionPrompt(importedCharge, potentialMatches),
        },
      ],
      temperature: 0,
      maxTokens: 50,
    });
    return resolveMatchedTransactionId(this.firstChoiceContent(response), potentialMatches);
  }

  private async complete({
    messages,
    maxTokens,
    temperature,
  }: ChatRequest): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    return this.getOpenAI().chat.completions.create({
      model: this.modelName(),
      messages,
      temperature,
      max_tokens: maxTokens,
    });
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
