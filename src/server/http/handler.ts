import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { ZodType, ZodError } from 'zod';
import logger from '@/server/logging/logger';
import { AuthError, requireUser } from '@/server/auth/session';
import { HttpError } from '@/server/http/errors';
import { optionalEnv, requireEnv } from '@/server/env';

type AuthMode = 'session' | 'cron' | 'telegram' | 'public';

export interface HandlerContext<TBody, TQuery> {
  req: NextRequest;
  userId: string;
  body: TBody;
  query: TQuery;
  params: Record<string, string>;
}

interface HandlerOptions<TBody, TQuery, TResult> {
  auth: AuthMode;
  bodySchema?: ZodType<TBody>;
  querySchema?: ZodType<TQuery>;
  status?: number;
  handler: (ctx: HandlerContext<TBody, TQuery>) => Promise<TResult>;
}

// Next passes segment params for dynamic routes; static routes get an empty
// object, so the loose Record type covers both.
type RouteContext = { params: Promise<Record<string, string>> };

async function resolveAuth(req: NextRequest, mode: AuthMode): Promise<string> {
  switch (mode) {
    case 'session':
      return requireUser(req);
    case 'cron': {
      const authHeader = req.headers.get('authorization');
      if (authHeader !== `Bearer ${requireEnv('CRON_SECRET')}`) {
        throw new AuthError('CRON_AUTH_FAILED', 'Authentication required');
      }
      return '';
    }
    case 'telegram': {
      const secret = optionalEnv('TELEGRAM_WEBHOOK_SECRET');
      const header = req.headers.get('x-telegram-bot-api-secret-token');
      if (!secret || header !== secret) {
        throw new AuthError('TELEGRAM_AUTH_FAILED', 'Authentication required');
      }
      return '';
    }
    case 'public':
      return '';
  }
}

function queryToObject(req: NextRequest): Record<string, string> {
  return Object.fromEntries(req.nextUrl.searchParams.entries());
}

function errorResponse(err: unknown, requestId: string): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 401 },
    );
  }
  if (err instanceof ZodError) {
    const message = err.issues
      .map((issue) =>
        issue.path.length
          ? `${issue.path.join('.')}: ${issue.message}`
          : issue.message,
      )
      .join('; ');
    return NextResponse.json({ message }, { status: 400 });
  }
  if (err instanceof HttpError) {
    return NextResponse.json({ message: err.message }, { status: err.status });
  }
  const error = (err ?? {}) as {
    name?: string;
    message?: string;
    status?: number;
  };
  if (error.name === 'CustomValidationError') {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  const status = error.status ?? 500;
  if (status >= 500) {
    Sentry.captureException(err, { tags: { requestId } });
  }
  return NextResponse.json(
    { message: error.message || 'Internal Server Error' },
    { status },
  );
}

export function createHandler<
  TBody = unknown,
  TQuery = unknown,
  TResult = unknown,
>(options: HandlerOptions<TBody, TQuery, TResult>) {
  return async (
    req: NextRequest,
    routeContext: RouteContext,
  ): Promise<NextResponse> => {
    const requestId = crypto.randomUUID();
    const started = Date.now();
    const path = req.nextUrl.pathname;
    let response: NextResponse;
    let userId = '';

    try {
      userId = await resolveAuth(req, options.auth);
      const params = routeContext ? await routeContext.params : {};
      const body = options.bodySchema
        ? options.bodySchema.parse(await req.json())
        : (undefined as TBody);
      const query = options.querySchema
        ? options.querySchema.parse(queryToObject(req))
        : (undefined as TQuery);

      const result = await options.handler({
        req,
        userId,
        body,
        query,
        params,
      });
      response =
        options.status === 204
          ? new NextResponse(null, { status: 204 })
          : NextResponse.json(result ?? {}, { status: options.status ?? 200 });
    } catch (err) {
      response = errorResponse(err, requestId);
      if (response.status >= 500) {
        logger.error({ requestId, path, err }, 'Request failed');
      }
    }

    logger.info(
      {
        requestId,
        method: req.method,
        path,
        status: response.status,
        durationMs: Date.now() - started,
        ...(userId && { userId }),
      },
      'request',
    );
    return response;
  };
}
