import { ChatGPTService } from '@/server/services/ai/chatGPTService';
import { GeminiService } from '@/server/services/ai/geminiService';
import { AIProvider } from '@/server/services/ai/aiProvider';

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
}

export default AIServiceFactory;
