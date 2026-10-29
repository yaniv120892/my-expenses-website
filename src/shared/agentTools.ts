// What the settings briefing tells an agent the MCP server offers. The server
// registers each tool under the same name; mcpTools.test.ts holds the two in
// step.
export const AGENT_TOOL_GUIDE = [
  {
    name: 'list_categories',
    purpose: 'every category name (they are English)',
  },
  {
    name: 'find_transactions',
    purpose: 'individual transactions with their ids, by date, category, type or text',
  },
  {
    name: 'summarize_transactions',
    purpose: 'a total, average, count, or breakdown by category or month, computed server-side',
  },
  {
    name: 'compare_periods',
    purpose: 'two date ranges side by side, with the difference and % change',
  },
  {
    name: 'get_spending_trends',
    purpose: 'how spending moved day by day, week, month or year',
  },
  {
    name: 'list_pending_transactions',
    purpose: 'recurring charges waiting for my approval in the app',
  },
  {
    name: 'list_scheduled_transactions',
    purpose: 'my recurring transactions and when each next runs',
  },
  {
    name: 'add_transaction',
    purpose: 'record an expense or income; the category is picked for you if you leave it out',
  },
  {
    name: 'update_transaction',
    purpose: 'change any field of one transaction, by id',
  },
  {
    name: 'delete_transaction',
    purpose: 'permanently delete one transaction, by id',
  },
] as const;
