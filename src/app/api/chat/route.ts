import * as Sentry from '@sentry/nextjs';
import { createHandler } from '@/server/http/handler';
import { chatRequestSchema } from '@/shared/schemas/chat';
import chatService from '@/server/services/chatService';
import logger from '@/server/logging/logger';
import { RATE_LIMITS } from '@/server/http/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function sseFrame(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export const POST = createHandler({
  auth: 'session',
  bodySchema: chatRequestSchema,
  // Each request can hold a model stream open for up to maxDuration, so
  // this caps the concurrent-stream cost per user, not just abuse.
  rateLimit: ({ userId }) => [
    { key: `chat:user:${userId}`, ...RATE_LIMITS.chat },
  ],
  handler: async ({ req, body, userId }) => {
    logger.debug({ userId }, 'Start handle chat message');

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const textStream = await chatService.streamChatResponse(
            body.messages,
            userId,
            req.signal,
          );

          for await (const delta of textStream) {
            controller.enqueue(sseFrame({ type: 'delta', value: delta }));
          }

          controller.enqueue(sseFrame({ type: 'done' }));
          logger.debug({ userId }, 'Done handle chat message');
        } catch (err) {
          if (!req.signal.aborted) {
            // createHandler already returned the 200 stream response, so this
            // failure reaches neither the error response nor onRequestError.
            logger.error({ err, userId }, 'Failed to handle chat message');
            Sentry.captureException(err, {
              tags: { path: '/api/chat' },
              user: { id: userId },
            });
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
