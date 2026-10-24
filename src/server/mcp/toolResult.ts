import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { HttpError } from '@/server/http/errors';
import { prismaErrorToHttpError } from '@/server/db/prismaErrors';
import { reportSwallowedError } from '@/server/logging/reportSwallowedError';

const NEUTRAL_FAILURE =
  'Something went wrong in My Expenses. Try again in a moment.';

export function toolSuccess(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

export function toolFailure(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

/**
 * A tool never throws at the model: a thrown error becomes an opaque protocol
 * failure, while a returned one ("Unknown category …, close matches: …") is
 * something the agent can correct or relay. A 4xx is written for the caller,
 * so its message passes through; anything else is reported and kept neutral.
 */
export function withToolErrorHandling<TInput>({
  toolName,
  userId,
  handler,
}: {
  toolName: string;
  userId: string;
  handler: (input: TInput) => Promise<CallToolResult>;
}): (input: TInput) => Promise<CallToolResult> {
  return async function handlesToolErrors(input: TInput) {
    try {
      return await handler(input);
    } catch (err) {
      const clientError = toClientError(err);
      if (clientError) {
        return toolFailure(clientError.message);
      }
      reportSwallowedError({ err, userId, toolName }, 'MCP tool failed');
      return toolFailure(NEUTRAL_FAILURE);
    }
  };
}

function toClientError(err: unknown): HttpError | undefined {
  const httpError =
    err instanceof HttpError ? err : prismaErrorToHttpError(err);
  return httpError && httpError.status < 500 ? httpError : undefined;
}
