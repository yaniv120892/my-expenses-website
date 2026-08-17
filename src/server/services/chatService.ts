import { RequestContext } from '@mastra/core/request-context';
import { getFinancialAssistant } from '@/server/services/assistant/financialAssistant';
import {
  getThreadId,
  isMemoryEnabled,
} from '@/server/services/assistant/memory';
import { USER_ID_CONTEXT_KEY } from '@/server/services/assistant/tools';

export interface ChatMessage {
  sender: string;
  text: string;
}

type OutgoingMessage =
  { role: 'user'; content: string } | { role: 'assistant'; content: string };

class ChatService {
  /**
   * Runs the assistant and returns a stream of text deltas. The agent decides
   * which tools to call; figures always come from tool results.
   */
  public async streamChatResponse(
    messages: ChatMessage[],
    userId: string,
    abortSignal?: AbortSignal,
  ): Promise<AsyncIterable<string>> {
    const assistant = getFinancialAssistant();

    // Injected server-side so the model cannot choose whose data it reads.
    const requestContext = new RequestContext();
    requestContext.set(USER_ID_CONTEXT_KEY, userId);

    const result = await assistant.stream(this.toModelMessages(messages), {
      memory: {
        thread: getThreadId(userId),
        resource: userId,
      },
      requestContext,
      ...(abortSignal ? { abortSignal } : {}),
    });

    return result.textStream;
  }

  /**
   * With memory active the thread already holds earlier turns, so only the
   * newest message is sent — resending all would append duplicates. Without
   * memory the full conversation is the only context there is.
   */
  private toModelMessages(messages: ChatMessage[]): OutgoingMessage[] {
    const selected = isMemoryEnabled() ? messages.slice(-1) : messages;

    return selected.map((message) =>
      message.sender === 'user'
        ? { role: 'user' as const, content: message.text }
        : { role: 'assistant' as const, content: message.text },
    );
  }
}

export default new ChatService();
