# Personal agent (MCP)

Load before changing `/api/mcp`, an MCP tool in `src/server/mcp/`, the Settings → Personal agent
briefing, or how either assistant reads or writes a date.

## The personal agent reaches the app only through `/api/mcp`

- It is an `auth: 'apiToken'` route needing `AGENT`, the token Settings → Personal agent (סוכן
  אישי) issues, and answers every refusal as a JSON-RPC error rather than a redirect or `{error}`
  body, so an MCP client can read it.
- The server is stateless (`src/server/mcp/handleMcpRequest.ts`): each POST builds one
  `createMcpServer(actor)`, answers one message and closes; a JSON-RPC batch is a 400 (`-32600`),
  since the rate limit counts requests; GET and DELETE are 405.
- The actor — and so the household — is captured in every tool's closure, so no tool takes one.
  Writes are checked per tool → [households.md](households.md), for the `'perOperation'` write
  guard.

## Tools

- Tools are adapters over existing services — reads through `financeQueryService` (the same code
  the Mastra tools call) and the transaction/schedule services, writes through
  `transactionService`, whose amounts go through `currencyConversionService` like any other create
  or edit.
- Every tool is registered through `registerSafeTool` (`src/server/mcp/safeTool.ts`), so a tool
  never throws: a 4xx comes back as an `isError` result with its message, anything else is
  reported via `observability.reportError` and returned neutrally, and each call logs one
  `MCP tool call` line with its outcome (and, on a write, the transaction id).
- Uuid ids go through `recordIdSchema` and amounts take the REST bounds →
  [money-and-currency.md](money-and-currency.md), for `MINIMUM_AMOUNT`/`MAXIMUM_AMOUNT`.
- The settings briefing names the tools from `src/shared/agentTools.ts`, which
  `src/server/mcp/mcpTools.test.ts` holds equal to the registered set.
- A transaction write's product event carries `channel: 'agent'` →
  [observability.md](observability.md), before adding a product event.

## Dates

- Every date an agent sends must be a real calendar day.
- An undated `add_transaction` — like any undated create
  (`transactionService.prepareCreateTransaction`) — takes the current Israel wall-clock time,
  stored as the form stores it (`toAppWallClock`, `src/shared/dates.ts`).
- A day either assistant prints from a stored transaction date reads its UTC fields
  (`toUtcDayString`), so it is right on a host off UTC; a schedule's `nextRunDate` is local
  midnight and stays on `toDayString`.
