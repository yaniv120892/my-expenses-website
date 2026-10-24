import type { z } from 'zod/v4';
import type {
  addTransactionSchema,
  deleteTransactionSchema,
  findTransactionsSchema,
  updateTransactionSchema,
} from '@/server/mcp/toolSchemas';

export type FindTransactionsInput = z.infer<typeof findTransactionsSchema>;
export type AddTransactionInput = z.infer<typeof addTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type DeleteTransactionInput = z.infer<typeof deleteTransactionSchema>;

/** The amount fields an agent can state, before conversion to ILS. */
export type AgentAmountInput = {
  amount: number;
  currency?: string;
  ilsAmount?: number;
};

/** The user every tool on one server acts for, fixed by the bearer token. */
export type McpActor = { userId: string };
