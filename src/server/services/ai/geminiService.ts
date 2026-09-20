import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import {
  AIProvider,
  CategoryEvaluation,
  ImportedChargeToMatch,
} from '@/server/services/ai/aiProvider';
import logger from '@/server/logging/logger';
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
  SUGGEST_CATEGORY_SYSTEM_PROMPT,
  buildCategoryEvaluation,
  resolveMatchedTransactionId,
} from '@/server/services/ai/prompts';
import { suggestCategoryOrNull } from '@/server/services/ai/suggestCategoryOrNull';

// Google retires a Flash generation roughly twice a year and names the
// successor in the 404 it starts returning, so the id is overridable: the next
// retirement is a dashboard edit rather than a deploy.
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

export class GeminiService implements AIProvider {
  private getGemini = lazy(
    () => new GoogleGenerativeAI(requireEnv('GEMINI_API_KEY')),
  );

  public async generateContent(prompt: string): Promise<string> {
    try {
      logger.debug({ prompt }, 'Start generating content');
      const model = this.generativeModel();
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
      reportSwallowedError(
        { err, model: this.modelName() },
        'Gemini API error',
      );
      return '';
    }
  }

  public async analyzeExpenses(
    expenseSummary: string,
    suffixPrompt?: string,
  ): Promise<string | null> {
    try {
      logger.debug('Start analyzing expenses');
      const model = this.generativeModel();
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

      return analysis || null;
    } catch (err) {
      reportSwallowedError(
        { err, model: this.modelName() },
        'Gemini API error',
      );
      return null;
    }
  }

  public async suggestCategory(
    expenseDescription: string,
    categoryOptions: Category[],
  ): Promise<string | null> {
    return suggestCategoryOrNull(
      () => this.evaluateCategory(expenseDescription, categoryOptions),
      this.modelName(),
      'Gemini API error',
    );
  }

  public async evaluateCategory(
    expenseDescription: string,
    categoryOptions: Category[],
  ): Promise<CategoryEvaluation> {
    logger.debug(
      { expenseDescription },
      'Start suggesting category for expense',
    );
    const response = await this.generativeModel().generateContent({
      systemInstruction: SUGGEST_CATEGORY_SYSTEM_PROMPT,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: buildSuggestCategoryPrompt(
                expenseDescription,
                categoryOptions,
              ),
            },
          ],
        },
      ],
    });

    const usage = response.response?.usageMetadata;
    const evaluation = buildCategoryEvaluation(
      response.response?.candidates?.[0]?.content?.parts?.[0]?.text,
      categoryOptions,
      {
        inputTokens: usage?.promptTokenCount ?? null,
        // candidatesTokenCount leaves out the thinking tokens Gemini bills as output.
        outputTokens: usage
          ? usage.totalTokenCount - usage.promptTokenCount
          : null,
      },
    );
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
    try {
      logger.debug(
        { importedDescription: importedCharge.description },
        'Start finding matching transaction',
      );

      if (!potentialMatches.length) {
        return null;
      }

      const model = this.generativeModel();
      const response = await model.generateContent({
        systemInstruction: FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: buildFindMatchingTransactionPrompt(
                  importedCharge,
                  potentialMatches,
                ),
              },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
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
      reportSwallowedError(
        { err, model: this.modelName() },
        'Error finding matching transaction',
      );
      return null;
    }
  }

  private generativeModel(): GenerativeModel {
    return this.getGemini().getGenerativeModel(
      { model: this.modelName() },
      { timeout: AI_REQUEST_LIMITS.timeoutMs },
    );
  }

  public modelName(): string {
    return optionalEnv('GEMINI_MODEL', DEFAULT_GEMINI_MODEL);
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
