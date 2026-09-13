import OpenAI from 'openai';
import {
  AIProvider,
  CategorizerHint,
  ImportedChargeToMatch,
} from '@/server/services/ai/aiProvider';
import { Category } from '@/shared/types/category';
import { Transaction } from '@/shared/types/transaction';
import { lazy } from '@/server/lib/lazy';
import { AI_REQUEST_LIMITS } from '@/server/services/ai/requestLimits';
import { optionalEnv, requireEnv } from '@/server/env';
import { reportSwallowedError } from '@/server/logging/reportSwallowedError';
import {
  buildAnalyzeExpensesPrompt,
  buildSuggestCategoryPrompt,
  buildFindMatchingTransactionPrompt,
  FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT,
  resolveMatchedTransactionId,
} from '@/server/services/ai/prompts';

// Overridable for the same reason as the Gemini id: a retired model should be
// a dashboard edit, not a deploy.
const DEFAULT_OPENAI_MODEL = 'gpt-4-turbo';

export class ChatGPTService implements AIProvider {
  private getOpenAI = lazy(
    () =>
      new OpenAI({
        apiKey: requireEnv('OPENAI_API_KEY'),
        timeout: AI_REQUEST_LIMITS.timeoutMs,
        maxRetries: AI_REQUEST_LIMITS.maxRetries,
      }),
  );

  public async generateContent(prompt: string): Promise<string> {
    try {
      const response = await this.getOpenAI().chat.completions.create({
        model: this.modelName(),
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 200,
      });

      return response.choices[0].message?.content || 'No insights available.';
    } catch (err) {
      reportSwallowedError(
        { err, model: this.modelName() },
        'ChatGPT API error',
      );
      return '';
    }
  }

  public async analyzeExpenses(
    expenseSummary: string,
    suffixPrompt?: string,
  ): Promise<string | null> {
    try {
      const response = await this.getOpenAI().chat.completions.create({
        model: this.modelName(),
        messages: [
          {
            role: 'system',
            content:
              'You are a financial assistant helping users analyze their expenses.',
          },
          {
            role: 'user',
            content: buildAnalyzeExpensesPrompt(expenseSummary, suffixPrompt),
          },
        ],
        max_tokens: 200,
      });

      return response.choices[0].message?.content || null;
    } catch (err) {
      reportSwallowedError(
        { err, model: this.modelName() },
        'ChatGPT API error',
      );
      return null;
    }
  }

  public async suggestCategory(
    expenseDescription: string,
    categoryOptions: Category[],
    categorizerHint?: CategorizerHint,
  ): Promise<string | null> {
    try {
      const userContent = buildSuggestCategoryPrompt(
        expenseDescription,
        categoryOptions,
        categorizerHint,
      );

      const response = await this.getOpenAI().chat.completions.create({
        model: this.modelName(),
        messages: [
          {
            role: 'system',
            content:
              'You are a financial assistant helping users categorize their expenses.',
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
        max_tokens: 50,
      });

      const aiSuggestedCategory = response.choices[0].message?.content?.trim();

      const suggestedCategory = categoryOptions.find(
        (category) => category.name === aiSuggestedCategory,
      );

      return suggestedCategory?.id ?? null;
    } catch (err) {
      reportSwallowedError(
        { err, model: this.modelName() },
        'ChatGPT API error',
      );
      return null;
    }
  }

  public async findMatchingTransaction(
    importedCharge: ImportedChargeToMatch,
    potentialMatches: Transaction[],
  ): Promise<string | null> {
    try {
      if (!potentialMatches.length) {
        return null;
      }

      const response = await this.getOpenAI().chat.completions.create({
        model: this.modelName(),
        messages: [
          {
            role: 'system',
            content: FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildFindMatchingTransactionPrompt(
              importedCharge,
              potentialMatches,
            ),
          },
        ],
        temperature: 0,
        max_tokens: 50,
      });

      return resolveMatchedTransactionId(
        response.choices[0].message?.content,
        potentialMatches,
      );
    } catch (err) {
      reportSwallowedError(
        { err, model: this.modelName() },
        'ChatGPT API error',
      );
      return null;
    }
  }

  private modelName(): string {
    return optionalEnv('OPENAI_MODEL', DEFAULT_OPENAI_MODEL);
  }
}
