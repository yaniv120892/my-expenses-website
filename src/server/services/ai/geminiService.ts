import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, CategorizerHint } from '@/server/services/ai/aiProvider';
import logger from '@/server/logging/logger';
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

const GEMINI_MODEL = 'gemini-2.0-flash';

export class GeminiService implements AIProvider {
  private getGemini = lazy(
    () => new GoogleGenerativeAI(requireEnv('GEMINI_API_KEY')),
  );

  public async generateContent(prompt: string): Promise<string> {
    try {
      logger.debug({ prompt }, 'Start generating content');
      const model = this.getGemini().getGenerativeModel({
        model: GEMINI_MODEL,
      });
      const response = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      });
      const content =
        response.response?.candidates?.[0]?.content?.parts?.[0]?.text;
      logger.debug({ prompt }, 'Done generating content');
      return content || '';
    } catch (err) {
      logger.error({ err }, 'Gemini API error');
      return 'I encountered an issue generating content.';
    }
  }

  public async analyzeExpenses(
    expenseSummary: string,
    suffixPrompt?: string,
  ): Promise<string> {
    try {
      logger.debug('Start analyzing expenses');
      const model = this.getGemini().getGenerativeModel({
        model: GEMINI_MODEL,
      });
      const response = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: buildAnalyzeExpensesPrompt(expenseSummary, suffixPrompt),
              },
            ],
          },
        ],
      });

      const analysis = this.cleanGeminiResponse(
        response.response?.candidates?.[0]?.content?.parts?.[0]?.text,
      );
      logger.debug({ analysis }, 'Done analyzing expenses');

      return analysis || 'No expense analysis available.';
    } catch (err) {
      logger.error({ err }, 'Gemini API error');
      return 'I encountered an issue analyzing your expenses.';
    }
  }

  public async suggestCategory(
    expenseDescription: string,
    categoryOptions: Category[],
    categorizerHint?: CategorizerHint,
  ): Promise<string | null> {
    try {
      logger.debug(
        { expenseDescription },
        'Start suggesting category for expense',
      );
      const model = this.getGemini().getGenerativeModel({
        model: GEMINI_MODEL,
      });

      const promptText = buildSuggestCategoryPrompt(
        expenseDescription,
        categoryOptions,
        categorizerHint,
      );

      const response = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }],
          },
        ],
      });

      const aiSuggestedCategory = this.cleanGeminiResponse(
        response.response?.candidates?.[0]?.content?.parts?.[0]?.text,
      );

      const categoryId = categoryOptions.find(
        (category) => category.name === aiSuggestedCategory,
      )?.id;

      logger.debug(
        { expenseDescription, aiSuggestedCategory },
        'Done suggesting category for expense',
      );
      return categoryId ?? null;
    } catch (err) {
      logger.error({ err }, 'Gemini API error');
      return null;
    }
  }

  public async findMatchingTransaction(
    importedDescription: string,
    potentialMatches: Transaction[],
  ): Promise<string | null> {
    try {
      logger.debug(
        { importedDescription },
        'Start finding matching transaction',
      );

      if (!potentialMatches.length) {
        return null;
      }

      const model = this.getGemini().getGenerativeModel({
        model: GEMINI_MODEL,
      });
      const response = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: buildFindMatchingTransactionPrompt(
                  importedDescription,
                  potentialMatches,
                ),
              },
            ],
          },
        ],
      });

      const result = resolveMatchedTransactionId(
        this.cleanGeminiResponse(
          response.response?.candidates?.[0]?.content?.parts?.[0]?.text,
        ),
        potentialMatches,
      );

      logger.debug({ result }, 'Done finding matching transaction');

      return result;
    } catch (err) {
      logger.error({ err }, 'Error finding matching transaction');
      return null;
    }
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
