import { createHandler } from '@/server/http/handler';
import { chatRequestSchema } from '@/shared/schemas/chat';
import chatService from '@/server/services/chatService';
import logger from '@/server/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function sseFrame(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export const POST = createHandler({
  auth: 'session',
  bodySchema: chatRequestSchema,
  handler: async ({ req, body, userId }) => {
    logger.debug({ userId }, 'Start handle chat message');

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const events = await chatService.streamChatResponse(
            body.messages,
            userId,
            req.signal,
          );

          // Events are already the wire shape — text deltas and the structured
          // views the tools produced — so they forward straight through.
          for await (const event of events) {
            controller.enqueue(sseFrame(event));
          }

          controller.enqueue(sseFrame({ type: 'done' }));
          logger.debug({ userId }, 'Done handle chat message');
        } catch (err) {
          if (!req.signal.aborted) {
            logger.error({ err, userId }, 'Failed to handle chat message');
            controller.enqueue(
              sseFrame({
                type: 'error',
                message:
                  "I'm sorry, something went wrong while I was trying to answer that. Please try again.",
              }),
            );
          }
        } finally {
          try {
            controller.close();
          } catch {
            // Already closed by a client disconnect.
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  },
});
