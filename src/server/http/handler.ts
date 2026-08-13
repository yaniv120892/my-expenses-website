import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { ZodType, ZodTypeDef, ZodError } from 'zod';
import logger from '@/server/logging/logger';
import { AuthError, requireUser } from '@/server/auth/session';
import { HttpError, formatZodIssues } from '@/server/http/errors';
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
  // Input is `unknown` because request data arrives as strings/JSON and the
  // schemas coerce (z.coerce, transforms), so schema input differs from output.
  bodySchema?: ZodType<TBody, ZodTypeDef, unknown>;
  querySchema?: ZodType<TQuery, ZodTypeDef, unknown>;
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

function errorResponse(
  err: unknown,
  requestId: string,
  userId: string,
): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 401 },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { message: formatZodIssues(err) },
      { status: 400 },
    );
  }
  if (err instanceof HttpError) {
    return NextResponse.json({ message: err.message }, { status: err.status });
  }
  const error = (err ?? {}) as { message?: string; status?: number };
  const status = error.status ?? 500;
  if (status >= 500) {
    Sentry.captureException(err, {
      tags: { requestId },
      ...(userId && { user: { id: userId } }),
    });
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
  ): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const started = Date.now();
    const path = req.nextUrl.pathname;
    let response: Response;
    let userId = '';

    try {
      userId = await resolveAuth(req, options.auth);
      const params = routeContext ? await routeContext.params : {};
      let body = undefined as TBody;
      if (options.bodySchema) {
        let raw: unknown;
        try {
          raw = await req.json();
        } catch {
          throw new HttpError(400, 'Invalid JSON body');
        }
        body = options.bodySchema.parse(raw);
      }
      const query = options.querySchema
        ? options.querySchema.parse(
            Object.fromEntries(req.nextUrl.searchParams.entries()),
          )
        : (undefined as TQuery);

      const result = await options.handler({
        req,
        userId,
        body,
        query,
        params,
      });
      // A handler may return a full Response (cookies, streams); anything
      // else is JSON-wrapped. null serializes as null; undefined becomes {}.
      if (result instanceof Response) {
        response = result;
      } else {
        response =
          options.status === 204
            ? new NextResponse(null, { status: 204 })
            : NextResponse.json(result === undefined ? {} : result, {
                status: options.status ?? 200,
              });
      }
    } catch (err) {
      response = errorResponse(err, requestId, userId);
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
