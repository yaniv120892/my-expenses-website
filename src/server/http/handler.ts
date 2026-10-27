import { NextRequest, NextResponse, after } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z, ZodType, ZodError } from 'zod';
import logger from '@/server/logging/logger';
import { flushRemoteLogs } from '@/server/logging/betterStackStream';
import {
  AuthError,
  extractBearerToken,
  extractCredential,
  requireUser,
} from '@/server/auth/session';
import { isApiToken } from '@/server/auth/apiTokenFormat';
import { authenticateApiToken } from '@/server/auth/apiTokens';
import type { ApiTokenScope } from '@/shared/types/apiToken';
import { HttpError, formatZodIssues } from '@/server/http/errors';
import { prismaErrorToHttpError } from '@/server/db/prismaErrors';
import { enforceRateLimits, RateLimitRule } from '@/server/http/rateLimit';
import { optionalEnv, requireEnv } from '@/server/env';
import { recordIdSchema } from '@/shared/schemas/common';
import { pingHeartbeat } from '@/server/monitoring/heartbeat';
import { secretsEqual } from '@/server/utils/webhookAuth';
import { JSON_RPC_ERROR_CODES, jsonRpcErrorResponse } from '@/server/http/jsonRpc';

type AuthMode = 'session' | 'apiToken' | 'cron' | 'telegram' | 'public';

// The body a protocol client parses: `json-rpc` keeps an MCP client reading a
// refusal as a JSON-RPC error instead of failing to parse it.
type ErrorFormat = 'json' | 'json-rpc';

type AuthOptions =
  | { auth: 'session'; apiTokenScope?: ApiTokenScope }
  | { auth: 'apiToken'; apiTokenScope: ApiTokenScope }
  | { auth: 'cron' | 'telegram' | 'public' };

type ErrorDescription = { status: number; message: string; code?: string };

const uuidRouteParamsSchema = z.record(z.string(), recordIdSchema);

export interface HandlerContext<TBody, TQuery, TParams = Record<string, string>> {
  req: NextRequest;
  userId: string;
  body: TBody;
  query: TQuery;
  params: TParams;
}

interface BaseHandlerOptions<TBody, TQuery, TResult, TParams> {
  // Input is `unknown` because request data arrives as strings/JSON and the
  // schemas coerce (z.coerce, transforms), so schema input differs from output.
  bodySchema?: ZodType<TBody, unknown>;
  querySchema?: ZodType<TQuery, unknown>;
  paramsSchema?: ZodType<TParams, unknown>;
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
        apiTokenScope?: never;
        errorFormat?: never;
      }
    | {
        auth: 'public';
        rateLimit: RateLimitResolver<TBody, TQuery, TParams> | 'none';
        heartbeatEnvVar?: never;
        apiTokenScope?: never;
        errorFormat?: never;
      }
    | {
        auth: 'session';
        rateLimit?: RateLimitResolver<TBody, TQuery, TParams>;
        heartbeatEnvVar?: never;
        apiTokenScope?: ApiTokenScope;
        errorFormat?: never;
      }
    | {
        auth: 'telegram';
        rateLimit?: RateLimitResolver<TBody, TQuery, TParams>;
        heartbeatEnvVar?: never;
        apiTokenScope?: never;
        errorFormat?: never;
      }
    | {
        // Bearer API token only; a session cookie on the request is ignored.
        auth: 'apiToken';
        apiTokenScope: ApiTokenScope;
        rateLimit?: RateLimitResolver<TBody, TQuery, TParams>;
        heartbeatEnvVar?: never;
        errorFormat?: ErrorFormat;
      }
  );

// A static route's params promise resolves to undefined, not an empty object.
type RouteContext = { params: Promise<Record<string, string> | undefined> };

function toRoutePattern(path: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (pattern, [name, value]) => (value ? pattern.replace(`/${value}`, `/[${name}]`) : pattern),
    path,
  );
}

type AuthResult = { userId: string; apiTokenId?: string };

// Only routes with a correcting client get the 4xx mapping. A cron or Telegram
// caller cannot correct a bad id, so its Prisma failures stay 500s and keep
// logging and alerting.
const MAPS_PRISMA_ERRORS = {
  session: true,
  apiToken: true,
  public: true,
  cron: false,
  telegram: false,
} satisfies Record<AuthMode, boolean>;

async function resolveAuth({
  req,
  options,
}: {
  req: NextRequest;
  options: AuthOptions;
}): Promise<AuthResult> {
  switch (options.auth) {
    case 'session': {
      // Only the Authorization header carries an API token: one in the
      // cookie would be a credential the browser attaches on its own.
      const credential = extractCredential(req);
      const isApiTokenBearer = credential?.source === 'bearer' && isApiToken(credential.token);
      if (!isApiTokenBearer) {
        return { userId: await requireUser(req) };
      }
      if (!options.apiTokenScope) {
        throw new AuthError('API_TOKEN_NOT_ACCEPTED', 'This route does not accept an API token');
      }
      return authenticateApiToken(credential.token, options.apiTokenScope);
    }
    case 'apiToken': {
      const token = bearerApiToken(req);
      if (!token) {
        throw new AuthError(
          'API_TOKEN_REQUIRED',
          'This route requires an API token as an Authorization: Bearer header',
        );
      }
      return authenticateApiToken(token, options.apiTokenScope);
    }
    case 'cron': {
      const authHeader = req.headers.get('authorization');
      if (!secretsEqual(authHeader, `Bearer ${requireEnv('CRON_SECRET')}`)) {
        throw new AuthError('CRON_AUTH_FAILED', 'Authentication required');
      }
      return { userId: '' };
    }
    case 'telegram': {
      const secret = optionalEnv('TELEGRAM_WEBHOOK_SECRET');
      const header = req.headers.get('x-telegram-bot-api-secret-token');
      if (!secret || !secretsEqual(header, secret)) {
        throw new AuthError('TELEGRAM_AUTH_FAILED', 'Authentication required');
      }
      return { userId: '' };
    }
    case 'public':
      return { userId: '' };
  }
}

function bearerApiToken(request: NextRequest): string | null {
  const token = extractBearerToken(request);
  return token && isApiToken(token) ? token : null;
}

function describeError({ err, auth }: { err: unknown; auth: AuthMode }): ErrorDescription {
  if (err instanceof AuthError) {
    return { status: 401, message: err.message, code: err.code };
  }
  if (err instanceof ZodError) {
    return { status: 400, message: formatZodIssues(err) };
  }
  if (err instanceof HttpError) {
    return { status: err.status, message: err.message };
  }
  const prismaHttpError = MAPS_PRISMA_ERRORS[auth] ? prismaErrorToHttpError(err) : undefined;
  if (prismaHttpError) {
    return describeError({ err: prismaHttpError, auth });
  }
  // Neutral to the client; a deliberate client-facing status must be thrown as
  // an HttpError.
  return { status: 500, message: 'Internal Server Error' };
}

// A bearer-only route says how to authenticate on every 401 (RFC 6750).
function errorResponse({
  err,
  auth,
  format,
}: {
  err: unknown;
  auth: AuthMode;
  format: ErrorFormat;
}): Response {
  const error = describeError({ err, auth });
  const headers =
    error.status === 401 && auth === 'apiToken'
      ? { 'www-authenticate': 'Bearer realm="my-expenses"' }
      : undefined;
  switch (format) {
    case 'json-rpc':
      return jsonRpcErrorResponse({
        status: error.status,
        code: toJsonRpcErrorCode(error.status),
        message: error.message,
        ...(error.code && { data: { code: error.code } }),
        headers,
      });
    case 'json': {
      const body = error.code
        ? { error: error.message, code: error.code }
        : { message: error.message };
      return NextResponse.json(body, { status: error.status, headers });
    }
  }
}

function toJsonRpcErrorCode(status: number): number {
  const isAuthFailure = status === 401 || status === 403;
  return isAuthFailure ? JSON_RPC_ERROR_CODES.UNAUTHORIZED : JSON_RPC_ERROR_CODES.SERVER_ERROR;
}

export function createHandler<
  TBody = unknown,
  TQuery = unknown,
  TResult = unknown,
  TParams = Record<string, string>,
>(options: HandlerOptions<TBody, TQuery, TResult, TParams>) {
  return async (req: NextRequest, routeContext: RouteContext): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const started = Date.now();
    const path = req.nextUrl.pathname;
    let response: Response;
    let userId = '';
    let apiTokenId: string | undefined;
    let params: Record<string, string> = {};

    try {
      ({ userId, apiTokenId } = await resolveAuth({ req, options }));
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
        ? options.querySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()))
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
      response = errorResponse({
        err,
        auth: options.auth,
        format: options.errorFormat ?? 'json',
      });
      if (response.status >= 500) {
        logger.error(
          {
            requestId,
            path,
            err,
            ...(userId && { userId }),
            ...(apiTokenId && { apiTokenId }),
          },
          'Request failed',
        );
        // The error becomes a response here, so Next's onRequestError never
        // sees it.
        Sentry.captureException(err, {
          tags: { path, requestId, ...(apiTokenId && { apiTokenId }) },
          ...(userId && { user: { id: userId } }),
        });
        // Raw params, not parsed: the replace must match the exact path text.
        const routePattern = toRoutePattern(path, params);
        after(async () => {
          // Dynamic import keeps the Telegram SDK out of every route's cold start.
          const { notifyOpsAlert } = await import('@/server/services/alertService');
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
        ...(apiTokenId && { apiTokenId }),
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
