import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, CategorizerHint } from '@/server/services/ai/aiProvider';
import logger from '@/server/logging/logger';
import { Category } from '@/shared/types/category';
import { Transaction } from '@/shared/types/transaction';
import { lazy } from '@/server/lib/lazy';
import { requireEnv } from '@/server/env';

export class GeminiService implements AIProvider {
  private modelName: string = 'gemini-2.0-flash';
  private getGemini = lazy(
    () => new GoogleGenerativeAI(requireEnv('GEMINI_API_KEY')),
  );

  async generateContent(prompt: string): Promise<string> {
    try {
      logger.debug({ prompt }, 'Start generating content');
      const model = this.getGemini().getGenerativeModel({
        model: this.modelName,
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

  async analyzeExpenses(
    expenseSummary: string,
    suffixPrompt?: string,
  ): Promise<string> {
    try {
      logger.debug('Start analyzing expenses');
      const model = this.getGemini().getGenerativeModel({
        model: this.modelName,
      });
      const response = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Analyze my recent expenses:\n\n${expenseSummary}, all expenses are in NIS, response in hebrew, no more than 2 sentences, add new line after each sentence, ${suffixPrompt}`,
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

  async suggestCategory(
    expenseDescription: string,
    categoryOptions: Category[],
    categorizerHint?: CategorizerHint,
  ): Promise<string> {
    try {
      logger.debug(
        { expenseDescription },
        'Start suggesting category for expense',
      );
      const model = this.getGemini().getGenerativeModel({
        model: this.modelName,
      });

      let promptText = `Which category does this expense belong to?\n\n"${expenseDescription}"\n\nAvailable categories:\n${categoryOptions.map((c) => `- ${c.name}`).join('\n')}`;

      if (categorizerHint) {
        promptText += `\n\nA machine learning model suggested "${categorizerHint.hint}" with ${Math.round(categorizerHint.confidence * 100)}% confidence. Consider this suggestion but use your own judgment.`;
      }

      promptText += '\n\nReturn only the category name, nothing else.';

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
      return categoryId || 'No category found.';
    } catch (err) {
      logger.error({ err }, 'Gemini API error');
      return 'I encountered an issue suggesting a category.';
    }
  }

  async findMatchingTransaction(
    importedDescription: string,
    potentialMatches: Transaction[],
  ): Promise<string | null> {
    try {
      logger.debug(
        { importedDescription },
        'Start finding matching transaction',
      );

      if (!potentialMatches.length) return null;

      const model = this.getGemini().getGenerativeModel({
        model: this.modelName,
      });
      const response = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `You are a helpful assistant that matches similar transaction descriptions. Your task is to find the most semantically similar transaction from a list of potential matches.

Rules:
1. Compare the imported description with each potential match
2. Consider semantic similarity, not just exact matches
3. Account for variations in merchant names and transaction descriptions
4. Return ONLY the ID of the best matching transaction
5. If no good match is found, return "none"
6. Do not explain your choice, just return the ID or "none"

Given this imported transaction description: "${importedDescription}"

Find the best matching transaction from this list:
${potentialMatches.map((t) => `- "${t.description}" (ID: ${t.id})`).join('\n')}

Return only the ID of the best match, or "none" if no good match exists.`,
              },
            ],
          },
        ],
      });

      const result = this.cleanGeminiResponse(
        response.response?.candidates?.[0]?.content?.parts?.[0]?.text,
      );

      logger.debug({ result }, 'Done finding matching transaction');

      return result === 'none' ? null : result;
    } catch (err) {
      logger.error({ err }, 'Error finding matching transaction');
      return null;
    }
  }

  private cleanGeminiResponse(response: string | undefined): string {
    if (!response) return '';
    return response
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/\n+/g, '\n')
      .trim();
  }
}
