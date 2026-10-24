// -32000 to -32099 is the range JSON-RPC 2.0 reserves for server-defined errors.
export const JSON_RPC_ERROR_CODES = {
  SERVER_ERROR: -32000,
  UNAUTHORIZED: -32001,
} as const;
