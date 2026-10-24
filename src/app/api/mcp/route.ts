import { createHandler } from '@/server/http/handler';
import { RATE_LIMITS } from '@/server/http/rateLimit';
import { JSON_RPC_ERROR_CODES } from '@/server/http/jsonRpc';
import { handleMcpRequest } from '@/server/mcp/handleMcpRequest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = createHandler({
  auth: 'apiToken',
  apiTokenScope: 'AGENT',
  errorFormat: 'json-rpc',
  rateLimit: ({ userId }) => [
    { key: `mcp:user:${userId}`, ...RATE_LIMITS.mcp },
  ],
  handler: async ({ req, userId }) =>
    handleMcpRequest({ request: req, userId }),
});

// Stateless: there is no server-to-client stream to open and no session to end.
export async function GET(): Promise<Response> {
  return statelessMethodNotAllowed();
}

export async function DELETE(): Promise<Response> {
  return statelessMethodNotAllowed();
}

function statelessMethodNotAllowed(): Response {
  return Response.json(
    {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: JSON_RPC_ERROR_CODES.SERVER_ERROR,
        message:
          'This MCP server is stateless; send JSON-RPC requests by POST.',
      },
    },
    { status: 405, headers: { allow: 'POST' } },
  );
}
