import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod/v4';
import logger from '@/server/logging/logger';
import { createMcpServer } from '@/server/mcp/createMcpServer';

const jsonRpcRequest = z.object({
  id: z.union([z.string(), z.number()]),
  method: z.string(),
});

const jsonRpcError = z.object({
  id: z.union([z.string(), z.number(), z.null()]),
  error: z.object({ code: z.number(), message: z.string() }),
});

/**
 * Stateless: a serverless function has no instance to pin an MCP session to,
 * so every request builds a server bound to the token's user, answers one
 * JSON-RPC message as plain JSON and closes. Nothing is kept between calls.
 */
export async function handleMcpRequest({
  request,
  userId,
}: {
  request: Request;
  userId: string;
}): Promise<Response> {
  const server = createMcpServer({ userId });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  const methods = await readRequestMethods(request);
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request);
    await warnOnProtocolErrors({ response, methods, userId });
    return response;
  } finally {
    await transport.close();
    await server.close();
  }
}

// The SDK answers a malformed message or an unknown method itself, as a
// JSON-RPC error inside a response createHandler only sees as a status.
async function warnOnProtocolErrors({
  response,
  methods,
  userId,
}: {
  response: Response;
  methods: Map<string | number, string>;
  userId: string;
}): Promise<void> {
  for (const message of await readMessages(response)) {
    const parsed = jsonRpcError.safeParse(message);
    if (parsed.success) {
      const { id, error } = parsed.data;
      logger.warn(
        {
          userId,
          method: id === null ? undefined : methods.get(id),
          code: error.code,
          message: error.message,
        },
        'MCP request answered with a JSON-RPC error',
      );
    }
  }
}

async function readRequestMethods(
  request: Request,
): Promise<Map<string | number, string>> {
  const methods = new Map<string | number, string>();
  for (const message of await readMessages(request)) {
    const parsed = jsonRpcRequest.safeParse(message);
    if (parsed.success) {
      methods.set(parsed.data.id, parsed.data.method);
    }
  }
  return methods;
}

// Reads a clone, so the body stays unread for the SDK or the client.
async function readMessages(body: Request | Response): Promise<unknown[]> {
  const isJson = body.headers.get('content-type')?.includes('application/json');
  if (!isJson) {
    return [];
  }
  try {
    const parsed: unknown = await body.clone().json();
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}
