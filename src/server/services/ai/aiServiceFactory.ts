import { ChatGPTService } from '@/server/services/ai/chatGPTService';
import { GeminiService } from '@/server/services/ai/geminiService';
import { JevCategorySuggester } from '@/server/services/ai/jevCategorySuggester';
import { AIProvider, CategorySuggester } from '@/server/services/ai/aiProvider';
import { optionalEnv } from '@/server/env';

class AIServiceFactory {
  public static getAIService(): AIProvider {
    const aiProvider = process.env.AI_PROVIDER?.toLowerCase();

    switch (aiProvider) {
      case 'gemini':
        return new GeminiService();
      case 'chatgpt':
      default:
        return new ChatGPTService();
    }
  }

  public static getCategorySuggester(): CategorySuggester {
    const categorySuggester = optionalEnv(
      'AI_CATEGORY_SUGGESTER',
    ).toLowerCase();

    switch (categorySuggester) {
      case 'jev':
        return new JevCategorySuggester();
      case '':
        return AIServiceFactory.getAIService();
      default:
        // Boot validation rejects this in production; outside it, failing here
        // beats silently categorizing with the LLM.
        throw new Error(
          `Unknown AI_CATEGORY_SUGGESTER "${categorySuggester}"; set it to "jev" or leave it unset`,
        );
    }
  }
}

export default AIServiceFactory;
