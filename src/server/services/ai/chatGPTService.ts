import OpenAI from 'openai';
import { AIProvider, CategorizerHint } from '@/server/services/ai/aiProvider';
import { Category } from '@/shared/types/category';
import { Transaction } from '@/shared/types/transaction';
import { lazy } from '@/server/lib/lazy';
import { requireEnv } from '@/server/env';
import {
  buildAnalyzeExpensesPrompt,
  buildSuggestCategoryPrompt,
  buildFindMatchingTransactionPrompt,
  resolveMatchedTransactionId,
} from '@/server/services/ai/prompts';
import logger from '@/server/logging/logger';

export class ChatGPTService implements AIProvider {
  private getOpenAI = lazy(
    () =>
      new OpenAI({
        apiKey: requireEnv('OPENAI_API_KEY'),
      }),
  );

  public async generateContent(prompt: string): Promise<string> {
    try {
      const response = await this.getOpenAI().chat.completions.create({
        model: 'gpt-4-turbo',
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
      logger.error({ err }, 'ChatGPT API error');
      return 'I encountered an issue generating content.';
    }
  }

  public async analyzeExpenses(
    expenseSummary: string,
    suffixPrompt?: string,
  ): Promise<string> {
    try {
      const response = await this.getOpenAI().chat.completions.create({
        model: 'gpt-4-turbo',
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

      return response.choices[0].message?.content || 'No insights available.';
    } catch (err) {
      logger.error({ err }, 'ChatGPT API error');
      return 'I encountered an issue analyzing your expenses.';
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
        model: 'gpt-4-turbo',
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
      logger.error({ err }, 'ChatGPT API error');
      return null;
    }
  }

  public async findMatchingTransaction(
    importedDescription: string,
    potentialMatches: Transaction[],
  ): Promise<string | null> {
    try {
      if (!potentialMatches.length) {
        return null;
      }

      const response = await this.getOpenAI().chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that matches similar transaction descriptions. Respond only with the ID of the best matching transaction or "none" if no good match is found.',
          },
          {
            role: 'user',
            content: buildFindMatchingTransactionPrompt(
              importedDescription,
              potentialMatches,
            ),
          },
        ],
        temperature: 0.3,
        max_tokens: 50,
      });

      return resolveMatchedTransactionId(
        response.choices[0].message?.content,
        potentialMatches,
      );
    } catch (err) {
      logger.error({ err }, 'ChatGPT API error');
      return null;
    }
  }
}
