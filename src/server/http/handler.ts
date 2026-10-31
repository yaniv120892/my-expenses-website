import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import type { ZodType } from 'zod';
import { z, ZodError } from 'zod';
import { logger, observability } from '@/server/observability';
import {
  AuthError,
  extractBearerToken,
  extractCredential,
  requireUser,
} from '@/server/auth/session';
import { isApiToken } from '@/server/auth/apiTokenFormat';
import { authenticateApiToken } from '@/server/auth/apiTokens';
import { assertCanWrite, resolveMemberActor } from '@/server/auth/householdActor';
import type { MemberActor } from '@/server/auth/householdActor.types';
import type { ApiTokenScope } from '@/shared/types/apiToken';
import { HttpError, formatZodIssues } from '@/server/http/errors';
import { prismaErrorToHttpError } from '@/server/db/prismaErrors';
import type { RateLimitRule } from '@/server/http/rateLimit';
import { enforceRateLimits } from '@/server/http/rateLimit';
import { optionalEnv, requireEnv } from '@/server/env';
import { recordIdSchema } from '@/shared/schemas/common';
import { secretsEqual } from '@/server/utils/webhookAuth';
import { JSON_RPC_ERROR_CODES, jsonRpcErrorResponse } from '@/server/http/jsonRpc';
import { assertNever } from '@/utils/assertNever';

type AuthMode = 'session' | 'apiToken' | 'cron' | 'telegram' | 'public';

// The body a protocol client parses: `json-rpc` keeps an MCP client reading a
// refusal as a JSON-RPC error instead of failing to parse it.
type ErrorFormat = 'json' | 'json-rpc';

// What a non-GET request on a member route writes. `household` (the default)
// is refused to a viewer before the handler runs; `ownAccount` touches only the
// caller's own settings, sessions or chat; `perOperation` is a channel that
// carries both reads and writes, whose writes call assertCanWrite themselves.
type WriteTarget = 'household' | 'ownAccount' | 'perOperation';

type AuthOptions =
  | { auth: 'session'; apiTokenScope?: ApiTokenScope }
  | { auth: 'apiToken'; apiTokenScope: ApiTokenScope }
  | { auth: 'cron' | 'telegram' | 'public' };

type ErrorDescription = { status: number; message: string; code?: string };

const uuidRouteParamsSchema = z.record(z.string(), recordIdSchema);

export type HandlerContext<TBody, TQuery, TParams = Record<string, string>> = {
  request: NextRequest;
  userId: string;
  body: TBody;
  query: TQuery;
  params: TParams;
};

type MemberHandlerContext<TBody, TQuery, TParams = Record<string, string>> = HandlerContext<
  TBody,
  TQuery,
  TParams
> & { actor: MemberActor };

type BaseHandlerOptions<TBody, TQuery, TParams> = {
  // Input is `unknown` because request data arrives as strings/JSON and the
  // schemas coerce (z.coerce, transforms), so schema input differs from output.
  bodySchema?: ZodType<TBody, unknown>;
  querySchema?: ZodType<TQuery, unknown>;
  paramsSchema?: ZodType<TParams, unknown>;
  status?: number;
};

type Handler<TContext, TResult> = (handlerContext: TContext) => Promise<TResult>;

type RateLimitResolver<TBody, TQuery, TParams = Record<string, string>> = (
  handlerContext: HandlerContext<TBody, TQuery, TParams>,
) => RateLimitRule[];

type HandlerOptions<TBody, TQuery, TResult, TParams> = BaseHandlerOptions<TBody, TQuery, TParams> &
  (
    | {
        auth: 'cron';
        handler: Handler<HandlerContext<TBody, TQuery, TParams>, TResult>;
        heartbeatEnvVar?: string;
        rateLimit?: never;
        apiTokenScope?: never;
        errorFormat?: never;
      }
    | {
        auth: 'public';
        handler: Handler<HandlerContext<TBody, TQuery, TParams>, TResult>;
        rateLimit: RateLimitResolver<TBody, TQuery, TParams> | 'none';
        heartbeatEnvVar?: never;
        apiTokenScope?: never;
        errorFormat?: never;
      }
    | {
        auth: 'session';
        handler: Handler<MemberHandlerContext<TBody, TQuery, TParams>, TResult>;
        writes?: WriteTarget;
        rateLimit?: RateLimitResolver<TBody, TQuery, TParams>;
        heartbeatEnvVar?: never;
        apiTokenScope?: ApiTokenScope;
        errorFormat?: never;
      }
    | {
        auth: 'telegram';
        handler: Handler<HandlerContext<TBody, TQuery, TParams>, TResult>;
        rateLimit?: RateLimitResolver<TBody, TQuery, TParams>;
        heartbeatEnvVar?: never;
        apiTokenScope?: never;
        errorFormat?: never;
      }
    | {
        // Bearer API token only; a session cookie on the request is ignored.
        auth: 'apiToken';
        handler: Handler<MemberHandlerContext<TBody, TQuery, TParams>, TResult>;
        writes?: WriteTarget;
        apiTokenScope: ApiTokenScope;
        rateLimit?: RateLimitResolver<TBody, TQuery, TParams>;
        heartbeatEnvVar?: never;
        errorFormat?: ErrorFormat;
      }
  );

// A static route's params promise resolves to undefined, not an empty object.
type RouteContext = { params: Promise<Record<string, string> | undefined> };

type RouteHandler = (request: NextRequest, routeContext: RouteContext) => Promise<Response>;

function toRoutePattern(path: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (pattern, [name, value]) => (value ? pattern.replace(`/${value}`, `/[${name}]`) : pattern),
    path,
  );
}

type AuthResult = { userId: string; apiTokenId?: string; actor?: MemberActor };

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

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
  request,
  options,
}: {
  request: NextRequest;
  options: AuthOptions;
}): Promise<AuthResult> {
  const authMode = options.auth;
  switch (authMode) {
    case 'session': {
      // Only the Authorization header carries an API token: one in the
      // cookie would be a credential the browser attaches on its own.
      const credential = extractCredential(request);
      const isApiTokenBearer = credential?.source === 'bearer' && isApiToken(credential.token);
      if (!isApiTokenBearer) {
        const { userId, tokenVersion } = await requireUser(request);
        return withActor({ userId, apiTokenId: null, sessionTokenVersion: tokenVersion });
      }
      if (!options.apiTokenScope) {
        throw new AuthError('API_TOKEN_NOT_ACCEPTED', 'This route does not accept an API token');
      }
      return apiTokenMember({ token: credential.token, scope: options.apiTokenScope });
    }
    case 'apiToken': {
      const token = bearerApiToken(request);
      if (!token) {
        throw new AuthError(
          'API_TOKEN_REQUIRED',
          'This route requires an API token as an Authorization: Bearer header',
        );
      }
      return apiTokenMember({ token, scope: options.apiTokenScope });
    }
    case 'cron': {
      const authHeader = request.headers.get('authorization');
      if (!secretsEqual(authHeader, `Bearer ${requireEnv('CRON_SECRET')}`)) {
        throw new AuthError('CRON_AUTH_FAILED', 'Authentication required');
      }
      return { userId: '' };
    }
    case 'telegram': {
      const secret = optionalEnv('TELEGRAM_WEBHOOK_SECRET');
      const header = request.headers.get('x-telegram-bot-api-secret-token');
      if (!secret || !secretsEqual(header, secret)) {
        throw new AuthError('TELEGRAM_AUTH_FAILED', 'Authentication required');
      }
      return { userId: '' };
    }
    case 'public':
      return { userId: '' };
    default:
      return assertNever({ value: authMode, what: 'auth mode' });
  }
}

async function withActor(identity: {
  userId: string;
  apiTokenId: string | null;
  sessionTokenVersion: number | null;
}): Promise<AuthResult> {
  const actor = await resolveMemberActor(identity);
  return {
    userId: identity.userId,
    ...(identity.apiTokenId && { apiTokenId: identity.apiTokenId }),
    actor,
  };
}

async function apiTokenMember({
  token,
  scope,
}: {
  token: string;
  scope: ApiTokenScope;
}): Promise<AuthResult> {
  const identity = await authenticateApiToken(token, scope);
  return withActor({ ...identity, sessionTokenVersion: null });
}

// Runs before the body is parsed or a rate-limit slot is spent, so a viewer's
// write is a 403 whatever it carries.
function assertMayWrite({
  request,
  options,
  auth,
}: {
  request: NextRequest;
  options: HandlerOptions<unknown, unknown, unknown, unknown>;
  auth: AuthResult;
}): void {
  switch (options.auth) {
    case 'session':
    case 'apiToken': {
      const isHouseholdWrite =
        !READ_ONLY_METHODS.has(request.method) && (options.writes ?? 'household') === 'household';
      if (isHouseholdWrite) {
        assertCanWrite(requireActor(auth));
      }
      return;
    }
    case 'cron':
    case 'telegram':
    case 'public':
      return;
    default:
      assertNever({ value: options, what: 'auth mode' });
  }
}

// Narrowed per auth mode, so only a member route's handler is handed the actor.
async function runHandler({
  options,
  handlerContext,
  auth,
}: {
  options: HandlerOptions<unknown, unknown, unknown, unknown>;
  handlerContext: HandlerContext<unknown, unknown, unknown>;
  auth: AuthResult;
}): Promise<unknown> {
  switch (options.auth) {
    case 'session':
    case 'apiToken': {
      return options.handler({ ...handlerContext, actor: requireActor(auth) });
    }
    case 'cron':
    case 'telegram':
    case 'public':
      return options.handler(handlerContext);
    default:
      return assertNever({ value: options, what: 'auth mode' });
  }
}

function requireActor({ actor, userId }: AuthResult): MemberActor {
  if (!actor) {
    throw new Error(`A member route resolved user ${userId} without loading their household`);
  }
  return actor;
}

function householdLogFields(actor: MemberActor | undefined): {
  householdId?: string;
  householdRole?: MemberActor['role'];
} {
  return actor ? { householdId: actor.householdId, householdRole: actor.role } : {};
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
    return { status: err.status, message: err.message, code: err.code };
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
        ? { error: error.message, message: error.message, code: error.code }
        : { message: error.message };
      return NextResponse.json(body, { status: error.status, headers });
    }
    default:
      return assertNever({ value: format, what: 'error format' });
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
>(options: HandlerOptions<TBody, TQuery, TResult, TParams>): RouteHandler;
// The implementation sees every schema output as `unknown`; the overload above is
// what ties a route's schemas to the context its handler receives.
export function createHandler(
  options: HandlerOptions<unknown, unknown, unknown, unknown>,
): RouteHandler {
  return async (request: NextRequest, routeContext: RouteContext): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const started = Date.now();
    const path = request.nextUrl.pathname;
    let response: Response;
    let userId = '';
    let apiTokenId: string | undefined;
    let actor: MemberActor | undefined;
    let params: Record<string, string> = {};

    try {
      const auth = await resolveAuth({ request, options });
      ({ userId, apiTokenId, actor } = auth);
      assertMayWrite({ request, options, auth });
      params = (routeContext ? await routeContext.params : undefined) ?? {};
      const parsedParams = (options.paramsSchema ?? uuidRouteParamsSchema).parse(params);
      let body: unknown;
      if (options.bodySchema) {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          throw new HttpError(400, 'Invalid JSON body');
        }
        body = options.bodySchema.parse(raw);
      }
      const query = options.querySchema?.parse(
        Object.fromEntries(request.nextUrl.searchParams.entries()),
      );

      const handlerContext = { request, userId, body, query, params: parsedParams };
      if (options.rateLimit && options.rateLimit !== 'none') {
        await enforceRateLimits(options.rateLimit(handlerContext));
      }

      const result = await runHandler({ options, handlerContext, auth });
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
            ...householdLogFields(actor),
          },
          'Request failed',
        );
        // The error becomes a response here, so Next's onRequestError never
        // sees it.
        Sentry.captureException(err, {
          tags: {
            path,
            requestId,
            ...(apiTokenId && { apiTokenId }),
            ...householdLogFields(actor),
          },
          ...(userId && { user: { id: userId } }),
        });
        // Raw params, not parsed: the replace must match the exact path text.
        const routePattern = toRoutePattern(path, params);
        observability.scheduleOpsAlert({
          alertType: `5xx ${request.method} ${routePattern}`,
          title: `5xx on ${request.method} ${path}`,
          error: err,
          context: { requestId, ...(userId && { userId }) },
        });
      }
    }

    logger.info(
      {
        requestId,
        method: request.method,
        path,
        status: response.status,
        durationMs: Date.now() - started,
        ...(userId && { userId }),
        ...(apiTokenId && { apiTokenId }),
        ...householdLogFields(actor),
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
      await observability.flushRemoteLogs();
      await observability.pingHeartbeat(options.heartbeatEnvVar);
    }

    return response;
  };
}
