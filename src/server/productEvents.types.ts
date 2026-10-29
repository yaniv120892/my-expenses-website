import type { ToolOutcome } from '@/server/mcp/safeTool.types';

export type AppPage =
  | 'dashboard'
  | 'transactions'
  | 'pending'
  | 'scheduled'
  | 'subscriptions'
  | 'imports'
  | 'trends'
  | 'settings';

export type ProductEvent =
  | { event: 'signed_up' }
  | { event: 'logged_in' }
  | { event: 'page_viewed'; properties: { page: AppPage } }
  | {
      event: 'transaction_created' | 'transaction_updated' | 'transaction_deleted';
      /** `web` is the app itself; `agent` is the personal agent over `/api/mcp`. */
      properties: { channel: 'web' | 'agent' };
    }
  | { event: 'statement_uploaded' }
  | { event: 'assistant_message_sent' }
  | { event: 'agent_tool_called'; properties: { tool: string; outcome: ToolOutcome } };

export type UserProductEvent = ProductEvent & { userId: string };
