import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerInsightTools } from '@/server/mcp/tools/insightTools';
import { registerScheduleTools } from '@/server/mcp/tools/scheduleTools';
import { registerTransactionTools } from '@/server/mcp/tools/transactionTools';
import type { McpActor } from '@/server/mcp/createMcpServer.types';

export const MCP_SERVER_INSTRUCTIONS = [
  "My Expenses is the user's personal expense tracker. Use these tools to answer questions about their spending and income and to record, correct or remove transactions.",
  'Every figure is in ILS (₪). A charge made in another currency keeps its original amount beside the ILS one; never add amounts yourself — summarize_transactions and compare_periods do the arithmetic.',
  'Category names are in English: call list_categories before filtering by category. When adding a transaction you may leave the category out and it will be chosen from the description.',
  "Dates are YYYY-MM-DD. Resolve relative dates (yesterday, last month) against today's date in Israel.",
  'Before deleting, show the user the transaction and get an explicit yes.',
].join('\n');

/**
 * The actor is captured in each tool's closure, so no tool takes a user id and
 * an agent cannot reach data other than the token owner's. The token is the
 * scope.
 */
export function createMcpServer(actor: McpActor): McpServer {
  const server = new McpServer(
    { name: 'my-expenses', version: '1.0.0' },
    { instructions: MCP_SERVER_INSTRUCTIONS },
  );

  registerInsightTools({ server, actor });
  registerTransactionTools({ server, actor });
  registerScheduleTools({ server, actor });

  return server;
}
