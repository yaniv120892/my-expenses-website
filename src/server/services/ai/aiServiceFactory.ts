import { ChatGPTService } from '@/server/services/ai/chatGPTService';
import { GeminiService } from '@/server/services/ai/geminiService';
import { JevCategorySuggester } from '@/server/services/ai/jevCategorySuggester';
import { AIProvider, CategorySuggester } from '@/server/services/ai/aiProvider';
import logger from '@/server/logging/logger';

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
    const categorySuggester = process.env.AI_CATEGORY_SUGGESTER?.toLowerCase();

    switch (categorySuggester) {
      case 'jev':
        return new JevCategorySuggester();
      case undefined:
      case '':
        return AIServiceFactory.getAIService();
      default:
        logger.warn(
          { categorySuggester },
          'Unknown AI_CATEGORY_SUGGESTER value; categorizing with AI_PROVIDER',
        );
        return AIServiceFactory.getAIService();
    }
  }
}

export default AIServiceFactory;
