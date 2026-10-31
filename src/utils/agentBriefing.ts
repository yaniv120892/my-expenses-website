import { AGENT_TOOL_GUIDE } from '@/shared/agentTools';

export const AGENT_TOKEN_PLACEHOLDER = '<paste the token shown once in Settings>';

/**
 * The message the owner pastes to their personal agent. English, because that
 * is what agents follow most reliably; self-contained, because the agent has
 * nothing else to go on.
 */
export function buildAgentBriefing({
  mcpUrl,
  token,
  readOnly = false,
}: {
  mcpUrl: string;
  token: string | null;
  readOnly?: boolean;
}): string {
  const tools = readOnly ? AGENT_TOOL_GUIDE.filter((tool) => !tool.writes) : AGENT_TOOL_GUIDE;
  const toolLines = tools.map((tool) => `- ${tool.name}: ${tool.purpose}`);
  return [
    readOnly
      ? 'I track my money in an app called My Expenses. Please use it whenever I ask about my spending or income.'
      : 'I track my money in an app called My Expenses. Please use it whenever I ask about my spending or income, or tell you about something I paid or received.',
    '',
    'HOW TO CONNECT',
    `- It is a remote MCP server (Streamable HTTP): ${mcpUrl}`,
    `- Send this header on every request: Authorization: Bearer ${token ?? AGENT_TOKEN_PLACEHOLDER}`,
    '- The token is mine and secret. Never show it in a chat or send it anywhere else. If you get a 401, ask me to issue a new one in My Expenses → Settings → Personal agent (in Hebrew: הגדרות → סוכן אישי).',
    '',
    'WHAT YOU CAN DO (MCP tools)',
    ...toolLines,
    '',
    'RULES',
    ...(readOnly ? READ_ONLY_RULES : READ_WRITE_RULES),
  ].join('\n');
}

const READ_WRITE_RULES = [
  '- Every amount is in ILS (₪). A charge in another currency: pass its amount and currency (USD, EUR…) and the app converts it at the official rate. Never convert or add amounts yourself.',
  '- I usually write in Hebrew; keep descriptions in the words I used. Category names are English, so map my words onto list_categories, or leave the category out.',
  "- Resolve relative dates (today, yesterday, last month) against today's date in Israel, as YYYY-MM-DD.",
  '- After adding or changing something, tell me the amount, date and category it was saved with.',
  '- Before deleting anything, show me the transaction and wait for an explicit yes.',
  '- If a tool returns an error, tell me what it said; do not retry with guessed values.',
];

const READ_ONLY_RULES = [
  '- I can only view this household in My Expenses, so you can look things up but never record, change or delete anything. Do not offer to; if I ask, tell me my access is view-only.',
  '- Every amount is in ILS (₪). Never convert or add amounts yourself.',
  '- I usually write in Hebrew. Category names are English, so map my words onto list_categories.',
  "- Resolve relative dates (today, yesterday, last month) against today's date in Israel, as YYYY-MM-DD.",
  '- If a tool returns an error, tell me what it said; do not retry with guessed values.',
];
