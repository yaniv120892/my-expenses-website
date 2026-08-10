import { RequestContext } from '@mastra/core/request-context';
import type { ChunkType } from '@mastra/core/stream';
import { getFinancialAssistant } from '@/server/services/assistant/financialAssistant';
import {
  getThreadId,
  isMemoryEnabled,
} from '@/server/services/assistant/memory';
import { USER_ID_CONTEXT_KEY } from '@/server/services/assistant/tools';
import {
  AssistantViewSink,
  VIEW_SINK_CONTEXT_KEY,
} from '@/server/services/assistant/viewSink';
import { AssistantStreamEvent } from '@/shared/types/chat';

export interface ChatMessage {
  sender: string;
  text: string;
}

type OutgoingMessage =
  { role: 'user'; content: string } | { role: 'assistant'; content: string };

class ChatService {
  /**
   * Runs the assistant and returns a stream of text deltas interleaved with the
   * structured views its tools produced. The agent decides which tools to call;
   * figures always come from tool results.
   */
  public async streamChatResponse(
    messages: ChatMessage[],
    userId: string,
    abortSignal?: AbortSignal,
  ): Promise<AsyncIterable<AssistantStreamEvent>> {
    const assistant = getFinancialAssistant();

    // Injected server-side so the model cannot choose whose data it reads.
    const requestContext = new RequestContext();
    requestContext.set(USER_ID_CONTEXT_KEY, userId);

    // Tools drop their renderable output here instead of returning it, keeping
    // it out of the model's context and out of the persisted memory thread.
    const viewSink = new AssistantViewSink();
    requestContext.set(VIEW_SINK_CONTEXT_KEY, viewSink);

    const result = await assistant.stream(this.toModelMessages(messages), {
      memory: {
        thread: getThreadId(userId),
        resource: userId,
      },
      requestContext,
      ...(abortSignal ? { abortSignal } : {}),
    });

    return this.toStreamEvents(result.fullStream, viewSink);
  }

  /**
   * Reads the agent's full chunk stream and emits only what the client renders.
   *
   * Views are drained when a tool call reports its result, so a card appears as
   * soon as its data exists rather than after the model finishes narrating.
   *
   * Typed as AsyncIterable rather than ReadableStream: fullStream is Node's web
   * stream, which the DOM lib's ReadableStream is not assignable to.
   */
  private async *toStreamEvents(
    fullStream: AsyncIterable<ChunkType>,
    viewSink: AssistantViewSink,
  ): AsyncGenerator<AssistantStreamEvent> {
    for await (const chunk of fullStream) {
      switch (chunk.type) {
        case 'text-delta':
          yield { type: 'delta', value: chunk.payload.text };
          break;
        case 'tool-result':
          yield* this.drainViews(viewSink);
          break;
        default:
          break;
      }
    }

    // A tool whose result chunk never arrived (an aborted or errored run) can
    // still have left a view behind; emitting it is better than dropping it.
    yield* this.drainViews(viewSink);
  }

  private *drainViews(
    viewSink: AssistantViewSink,
  ): Generator<AssistantStreamEvent> {
    for (const view of viewSink.drain()) {
      yield { type: 'view', view };
    }
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
