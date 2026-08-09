import { NextRequest, NextResponse } from 'next/server';
import { chatRequestSchema } from '@/shared/schemas/chat';
import chatService from '@/server/services/chatService';
import { AuthError, requireUser } from '@/server/auth/session';
import logger from '@/server/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function sseFrame(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function POST(req: NextRequest): Promise<Response> {
  let userId: string;
  try {
    userId = await requireUser(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 401 },
      );
    }
    throw err;
  }

  const parsed = chatRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'At least one message is required.' },
      { status: 400 },
    );
  }

  logger.debug({ userId }, 'Start handle chat message');

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const textStream = await chatService.streamChatResponse(
          parsed.data.messages,
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
}
