import { createHandler } from '@/server/http/handler';
import { RATE_LIMITS } from '@/server/http/rateLimit';
import { JSON_RPC_ERROR_CODES, jsonRpcErrorResponse } from '@/server/http/jsonRpc';
import { handleMcpRequest } from '@/server/mcp/handleMcpRequest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = createHandler({
  auth: 'apiToken',
  apiTokenScope: 'AGENT',
  errorFormat: 'json-rpc',
  rateLimit: ({ userId }) => [{ key: `mcp:user:${userId}`, ...RATE_LIMITS.mcp }],
  handler: async ({ req, userId }) => handleMcpRequest({ request: req, userId }),
});

// Stateless: there is no server-to-client stream to open and no session to end.
export const GET = statelessMethodNotAllowed;
export const DELETE = statelessMethodNotAllowed;

async function statelessMethodNotAllowed(): Promise<Response> {
  return jsonRpcErrorResponse({
    status: 405,
    code: JSON_RPC_ERROR_CODES.SERVER_ERROR,
    message: 'This MCP server is stateless; send JSON-RPC requests by POST.',
    headers: { allow: 'POST' },
  });
}
