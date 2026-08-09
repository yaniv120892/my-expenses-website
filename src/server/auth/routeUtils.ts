import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import * as Sentry from '@sentry/nextjs';
import logger from '@/server/logging/logger';

export async function handleAuthRoute(
  req: NextRequest,
  run: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const started = Date.now();
  const path = req.nextUrl.pathname;
  let response: NextResponse;
  try {
    response = await run();
  } catch (err) {
    if (err instanceof ZodError) {
      const message = err.issues
        .map((issue) =>
          issue.path.length
            ? `${issue.path.join('.')}: ${issue.message}`
            : issue.message,
        )
        .join('; ');
      response = NextResponse.json({ error: message }, { status: 400 });
    } else {
      logger.error({ err, path }, 'Auth route failed');
      Sentry.captureException(err);
      response = NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 },
      );
    }
  }
  logger.info(
    {
      method: req.method,
      path,
      status: response.status,
      durationMs: Date.now() - started,
    },
    'request',
  );
  return response;
}
