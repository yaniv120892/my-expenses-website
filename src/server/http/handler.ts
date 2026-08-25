import { NextRequest, NextResponse, after } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { ZodType, ZodTypeDef, ZodError } from 'zod';
import logger from '@/server/logging/logger';
import { flushRemoteLogs } from '@/server/logging/betterStackStream';
import { AuthError, requireUser } from '@/server/auth/session';
import { HttpError, formatZodIssues } from '@/server/http/errors';
import { optionalEnv, requireEnv } from '@/server/env';
import { pingHeartbeat } from '@/server/monitoring/heartbeat';

type AuthMode = 'session' | 'cron' | 'telegram' | 'public';

export interface HandlerContext<TBody, TQuery> {
  req: NextRequest;
  userId: string;
  body: TBody;
  query: TQuery;
  params: Record<string, string>;
}

interface BaseHandlerOptions<TBody, TQuery, TResult> {
  // Input is `unknown` because request data arrives as strings/JSON and the
  // schemas coerce (z.coerce, transforms), so schema input differs from output.
  bodySchema?: ZodType<TBody, ZodTypeDef, unknown>;
  querySchema?: ZodType<TQuery, ZodTypeDef, unknown>;
  status?: number;
  handler: (ctx: HandlerContext<TBody, TQuery>) => Promise<TResult>;
}

type HandlerOptions<TBody, TQuery, TResult> = BaseHandlerOptions<
  TBody,
  TQuery,
  TResult
> &
  (
    | {
        auth: 'cron';
        // Better Stack heartbeat env var, pinged only after a <400 response.
        heartbeatEnvVar?: string;
      }
    | { auth: Exclude<AuthMode, 'cron'>; heartbeatEnvVar?: never }
  );

// Next passes segment params for dynamic routes; static routes get an empty
// object, so the loose Record type covers both.
type RouteContext = { params: Promise<Record<string, string>> };

// `/api/transactions/<uuid>` becomes `/api/transactions/[id]`, so alert quotas
// are keyed per route rather than per record id.
function toRoutePattern(path: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (pattern, [name, value]) =>
      value ? pattern.replace(`/${value}`, `/[${name}]`) : pattern,
    path,
  );
}

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

function errorResponse(err: unknown): NextResponse {
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
  // An error never maps to a success status: callers (heartbeats, the 5xx log)
  // read `status < 400` as "the handler resolved".
  const status = error.status && error.status >= 400 ? error.status : 500;
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
    let params: Record<string, string> = {};

    try {
      userId = await resolveAuth(req, options.auth);
      params = routeContext ? await routeContext.params : {};
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
      response = errorResponse(err);
      if (response.status >= 500) {
        logger.error(
          { requestId, path, err, ...(userId && { userId }) },
          'Request failed',
        );
        // This catch is why Next's onRequestError never fires for an API
        // route: the error becomes a response here, so Sentry only learns
        // about it if we report it ourselves.
        Sentry.captureException(err, {
          tags: { path, requestId },
          ...(userId && { user: { id: userId } }),
        });
        const routePattern = toRoutePattern(path, params);
        after(async () => {
          // Dynamic import keeps the Telegram SDK out of every route's cold start.
          const { notifyOpsAlert } =
            await import('@/server/services/alertService');
          await notifyOpsAlert({
            alertType: `5xx ${req.method} ${routePattern}`,
            title: `5xx on ${req.method} ${path}`,
            err,
            context: { requestId, ...(userId && { userId }) },
          });
        });
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
        // A cron runs a handful of times a day and its only other signal is a
        // heartbeat that says nothing about why it stayed silent, so its
        // request line ships even though info normally does not.
        ...(options.auth === 'cron' && { ship: true }),
      },
      'request',
    );

    // Awaited rather than deferred: crons are not latency-sensitive, and the
    // ping is logged after the request line so it stays out of durationMs.
    if (options.heartbeatEnvVar && response.status < 400) {
      // The run's own records go out before the ping, which is the outbound
      // call most likely to hang: a request killed there still leaves behind
      // the line saying it got that far.
      await flushRemoteLogs();
      await pingHeartbeat(options.heartbeatEnvVar);
    }

    // One batched POST per request, run after the response so it cannot add
    // latency, and before the serverless instance freezes. Registered last so
    // the batch includes anything the heartbeat ping logged.
    after(() => flushRemoteLogs());
    return response;
  };
}
