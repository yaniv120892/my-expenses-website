import { NextRequest, NextResponse, after } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z, ZodType, ZodTypeDef, ZodError } from 'zod';
import logger from '@/server/logging/logger';
import { flushRemoteLogs } from '@/server/logging/betterStackStream';
import { AuthError, requireUser } from '@/server/auth/session';
import { HttpError, formatZodIssues } from '@/server/http/errors';
import { prismaErrorToHttpError } from '@/server/db/prismaErrors';
import { enforceRateLimits, RateLimitRule } from '@/server/http/rateLimit';
import { optionalEnv, requireEnv } from '@/server/env';
import { pingHeartbeat } from '@/server/monitoring/heartbeat';
import { secretsEqual } from '@/server/utils/webhookAuth';

type AuthMode = 'session' | 'cron' | 'telegram' | 'public';

const uuidRouteParamsSchema = z.record(z.string().uuid());

export interface HandlerContext<
  TBody,
  TQuery,
  TParams = Record<string, string>,
> {
  req: NextRequest;
  userId: string;
  body: TBody;
  query: TQuery;
  params: TParams;
}

interface BaseHandlerOptions<TBody, TQuery, TResult, TParams> {
  // Input is `unknown` because request data arrives as strings/JSON and the
  // schemas coerce (z.coerce, transforms), so schema input differs from output.
  bodySchema?: ZodType<TBody, ZodTypeDef, unknown>;
  querySchema?: ZodType<TQuery, ZodTypeDef, unknown>;
  paramsSchema?: ZodType<TParams, ZodTypeDef, unknown>;
  status?: number;
  handler: (ctx: HandlerContext<TBody, TQuery, TParams>) => Promise<TResult>;
}

type RateLimitResolver<TBody, TQuery, TParams = Record<string, string>> = (
  handlerContext: HandlerContext<TBody, TQuery, TParams>,
) => RateLimitRule[];

type HandlerOptions<TBody, TQuery, TResult, TParams> = BaseHandlerOptions<
  TBody,
  TQuery,
  TResult,
  TParams
> &
  (
    | {
        auth: 'cron';
        heartbeatEnvVar?: string;
        rateLimit?: never;
      }
    | {
        auth: 'public';
        rateLimit: RateLimitResolver<TBody, TQuery, TParams> | 'none';
        heartbeatEnvVar?: never;
      }
    | {
        auth: 'session' | 'telegram';
        rateLimit?: RateLimitResolver<TBody, TQuery, TParams>;
        heartbeatEnvVar?: never;
      }
  );

// A static route's params promise resolves to undefined, not an empty object.
type RouteContext = { params: Promise<Record<string, string> | undefined> };

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
      if (!secretsEqual(authHeader, `Bearer ${requireEnv('CRON_SECRET')}`)) {
        throw new AuthError('CRON_AUTH_FAILED', 'Authentication required');
      }
      return '';
    }
    case 'telegram': {
      const secret = optionalEnv('TELEGRAM_WEBHOOK_SECRET');
      const header = req.headers.get('x-telegram-bot-api-secret-token');
      if (!secret || !secretsEqual(header, secret)) {
        throw new AuthError('TELEGRAM_AUTH_FAILED', 'Authentication required');
      }
      return '';
    }
    case 'public':
      return '';
  }
}

function errorResponse(err: unknown, auth: AuthMode): NextResponse {
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
  // Only routes with a human client get the 4xx mapping. A cron or Telegram
  // caller cannot correct a bad id, so its Prisma failures stay 500s and keep
  // logging and alerting.
  if (auth === 'session' || auth === 'public') {
    const prismaHttpError = prismaErrorToHttpError(err);
    if (prismaHttpError) {
      return errorResponse(prismaHttpError, auth);
    }
  }
  // Neutral to the client; a deliberate client-facing status must be thrown as
  // an HttpError.
  return NextResponse.json(
    { message: 'Internal Server Error' },
    { status: 500 },
  );
}

export function createHandler<
  TBody = unknown,
  TQuery = unknown,
  TResult = unknown,
  TParams = Record<string, string>,
>(options: HandlerOptions<TBody, TQuery, TResult, TParams>) {
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
      params = (routeContext ? await routeContext.params : undefined) ?? {};
      const parsedParams = options.paramsSchema
        ? options.paramsSchema.parse(params)
        : (uuidRouteParamsSchema.parse(params) as TParams);
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

      const handlerContext = { req, userId, body, query, params: parsedParams };
      if (options.rateLimit && options.rateLimit !== 'none') {
        await enforceRateLimits(options.rateLimit(handlerContext));
      }

      const result = await options.handler(handlerContext);
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
      response = errorResponse(err, options.auth);
      if (response.status >= 500) {
        logger.error(
          { requestId, path, err, ...(userId && { userId }) },
          'Request failed',
        );
        // The error becomes a response here, so Next's onRequestError never
        // sees it.
        Sentry.captureException(err, {
          tags: { path, requestId },
          ...(userId && { user: { id: userId } }),
        });
        // Raw params, not parsed: the replace must match the exact path text.
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
        // A cron's request line ships even though info normally does not: its
        // only other signal is a heartbeat that cannot say why it went silent.
        ...(options.auth === 'cron' && { ship: true }),
      },
      'request',
    );

    // Awaited and logged after the request line, so the ping stays out of
    // durationMs.
    if (options.heartbeatEnvVar && response.status < 400) {
      // Flushed before the ping, the call most likely to hang, so a run killed
      // there still leaves its request line.
      await flushRemoteLogs();
      await pingHeartbeat(options.heartbeatEnvVar);
    }

    // Registered last so the batch includes anything the heartbeat ping logged.
    after(() => flushRemoteLogs());
    return response;
  };
}
