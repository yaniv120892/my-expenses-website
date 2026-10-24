// -32000 to -32099 is the range JSON-RPC 2.0 reserves for server-defined errors.
export const JSON_RPC_ERROR_CODES = {
  SERVER_ERROR: -32000,
  UNAUTHORIZED: -32001,
} as const;

type JsonRpcErrorResponseInit = {
  status: number;
  code: number;
  message: string;
  data?: Record<string, unknown>;
  headers?: HeadersInit;
};

/** A refusal made before any JSON-RPC message was read, so it answers id null. */
export function jsonRpcErrorResponse({
  status,
  code,
  message,
  data,
  headers,
}: JsonRpcErrorResponseInit): Response {
  return Response.json(
    {
      jsonrpc: '2.0',
      id: null,
      error: { code, message, ...(data && { data }) },
    },
    { status, headers },
  );
}
