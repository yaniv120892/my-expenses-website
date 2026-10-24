import { AGENT_TOOL_GUIDE } from '@/shared/agentTools';

export const AGENT_TOKEN_PLACEHOLDER =
  '<paste the token shown once in Settings>';

/**
 * The message the owner pastes to their personal agent. English, because that
 * is what agents follow most reliably; self-contained, because the agent has
 * nothing else to go on.
 */
export function buildAgentBriefing({
  mcpUrl,
  token,
}: {
  mcpUrl: string;
  token: string | null;
}): string {
  const toolLines = AGENT_TOOL_GUIDE.map(
    (tool) => `- ${tool.name}: ${tool.purpose}`,
  );
  return [
    'I track my money in an app called My Expenses. Please use it whenever I ask about my spending or income, or tell you about something I paid or received.',
    '',
    'HOW TO CONNECT',
    `- It is a remote MCP server (Streamable HTTP): ${mcpUrl}`,
    `- Send this header on every request: Authorization: Bearer ${token ?? AGENT_TOKEN_PLACEHOLDER}`,
    '- The token is mine and secret. Never show it in a chat or send it anywhere else. If you get a 401, ask me to issue a new one in My Expenses → Settings → סוכן אישי.',
    '',
    'WHAT YOU CAN DO (MCP tools)',
    ...toolLines,
    '',
    'RULES',
    '- Every amount is in ILS (₪). A charge in another currency: pass its amount and currency (USD, EUR…) and the app converts it at the official rate. Never convert or add amounts yourself.',
    '- I usually write in Hebrew; keep descriptions in the words I used. Category names are English, so map my words onto list_categories, or leave the category out.',
    "- Resolve relative dates (today, yesterday, last month) against today's date in Israel, as YYYY-MM-DD.",
    '- After adding or changing something, tell me the amount, date and category it was saved with.',
    '- Before deleting anything, show me the transaction and wait for an explicit yes.',
    '- If a tool returns an error, tell me what it said; do not retry with guessed values.',
  ].join('\n');
}
