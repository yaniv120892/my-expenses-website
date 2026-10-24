import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '@/server/mcp/createMcpServer';

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

  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await transport.close();
    await server.close();
  }
}
