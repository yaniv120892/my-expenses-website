import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  ShapeOutput,
  ZodRawShapeCompat,
} from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { HttpError } from '@/server/http/errors';
import { prismaErrorToHttpError } from '@/server/db/prismaErrors';
import { logger, observability } from '@/server/observability';
import type { McpActor } from '@/server/mcp/createMcpServer.types';
import type { ToolOutcome } from '@/server/mcp/safeTool.types';
import { captureProductEvent } from '@/server/productEvents';
// A write names the transaction it touched, so the call's log line carries it.
type ToolReply = string | { text: string; transactionId: string };

type SafeToolRegistration<TShape extends ZodRawShapeCompat> = {
  server: McpServer;
  actor: McpActor;
  name: string;
  config: {
    title: string;
    description: string;
    inputSchema: TShape;
    annotations: ToolAnnotations;
  };
  handler: (input: ShapeOutput<TShape>) => Promise<ToolReply>;
};

const NEUTRAL_FAILURE = 'Something went wrong in My Expenses. Try again in a moment.';

export const READ_ONLY = {
  readOnlyHint: true,
  openWorldHint: false,
} as const satisfies ToolAnnotations;

/**
 * A tool never throws at the model: a thrown error becomes an opaque protocol
 * failure, while a returned one ("Unknown category …, close matches: …") is
 * something the agent can correct or relay. A 4xx is written for the caller,
 * so its message passes through; anything else is reported and kept neutral.
 * Every call logs one line with its outcome.
 */
export function registerSafeTool<TShape extends ZodRawShapeCompat>(
  registration: SafeToolRegistration<TShape>,
): void;
// ToolCallback is conditional on the shape, which TypeScript cannot resolve for
// a generic one, so the implementation works on the widest shape and the
// overload above keeps each tool's input typed.
export function registerSafeTool({
  server,
  actor,
  name,
  config,
  handler,
}: SafeToolRegistration<ZodRawShapeCompat>): void {
  async function handlesToolErrors(input: ShapeOutput<ZodRawShapeCompat>): Promise<CallToolResult> {
    const started = Date.now();
    const recordCall = ({
      outcome,
      transactionId,
    }: {
      outcome: ToolOutcome;
      transactionId?: string;
    }) => {
      logger.info(
        {
          userId: actor.userId,
          toolName: name,
          outcome,
          durationMs: Date.now() - started,
          ...(transactionId && { transactionId }),
        },
        'MCP tool call',
      );
      captureProductEvent(actor.userId, {
        event: 'agent_tool_called',
        properties: { tool: name, outcome },
      });
    };
    try {
      const reply = await handler(input);
      if (typeof reply === 'string') {
        recordCall({ outcome: 'ok' });
        return toolSuccess(reply);
      }
      recordCall({ outcome: 'ok', transactionId: reply.transactionId });
      return toolSuccess(reply.text);
    } catch (error) {
      const clientError = toClientError(error);
      if (clientError) {
        recordCall({ outcome: 'client_error' });
        return toolFailure(clientError.message);
      }
      recordCall({ outcome: 'server_error' });
      observability.reportError({
        error,
        where: 'MCP tool failed',
        context: { userId: actor.userId, toolName: name },
      });
      return toolFailure(NEUTRAL_FAILURE);
    }
  }

  server.registerTool(name, config, handlesToolErrors);
}

function toolSuccess(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

function toolFailure(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

function toClientError(error: unknown): HttpError | undefined {
  const httpError = error instanceof HttpError ? error : prismaErrorToHttpError(error);
  return httpError && httpError.status < 500 ? httpError : undefined;
}
