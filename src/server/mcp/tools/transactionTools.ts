import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ShapeOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import financeQueryService from '@/server/services/assistant/financeQueries';
import transactionService from '@/server/services/transactionService';
import { CustomValidationError } from '@/server/errors/validationError';
import { HttpError } from '@/server/http/errors';
import { BASE_CURRENCY, isForeignCurrency } from '@/shared/currency';
import { toAppWallClock } from '@/shared/dates';
import type {
  Transaction,
  TransactionAmountInput,
} from '@/shared/types/transaction';
import {
  addTransactionShape,
  deleteTransactionShape,
  findTransactionsShape,
  updateTransactionShape,
} from '@/server/mcp/toolSchemas';
import type { McpActor } from '@/server/mcp/createMcpServer.types';
import { READ_ONLY, registerSafeTool } from '@/server/mcp/safeTool';
import {
  describeTransaction,
  describeTransactions,
} from '@/server/mcp/transactionText';

type UpdateTransactionInput = ShapeOutput<typeof updateTransactionShape>;

/** The amount fields an agent can state, before conversion to ILS. */
type AgentAmountInput = {
  amount: number;
  currency?: string;
  ilsAmount?: number;
};

export function registerTransactionTools({
  server,
  actor,
}: {
  server: McpServer;
  actor: McpActor;
}): void {
  const { userId } = actor;

  registerSafeTool({
    server,
    actor,
    name: 'find_transactions',
    config: {
      title: 'Find transactions',
      description:
        'Lists individual approved transactions matching the filters, newest first, one per line as "id | date | description | amount | category | type". Use it to show the user specific transactions and to find the id before updating or deleting one. Amounts are in ILS; a foreign charge shows its original amount first, e.g. "$25.00 · ₪92.35".',
      inputSchema: findTransactionsShape,
      annotations: READ_ONLY,
    },
    handler: async ({ limit, ...filters }) => {
      const { transactions, hasMore } =
        await financeQueryService.findTransactions({ userId, filters, limit });
      const lines = describeTransactions({
        transactions,
        emptyText: 'No transactions match those filters.',
      });
      if (!hasMore) {
        return lines;
      }
      return `${lines}\n\nNote: these are only the newest ${transactions.length}; more transactions match. Narrow the filters, or use summarize_transactions for totals.`;
    },
  });

  registerSafeTool({
    server,
    actor,
    name: 'add_transaction',
    config: {
      title: 'Add a transaction',
      description:
        'Records one expense or income, exactly as if the user had typed it into the app. Without categoryName the category is chosen from the description. A foreign-currency amount is converted to ILS at the official rate for the date unless ilsAmount is given. Returns the stored transaction, including its id and category; tell the user both the amount and the category it was filed under.',
      inputSchema: addTransactionShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    handler: async (input) => {
      const { transaction } = await transactionService.createTransaction({
        description: input.description,
        ...toAmountInput(input),
        type: input.type,
        date: toTransactionDate({
          day: input.date,
          fallback: toAppWallClock(new Date()),
        }),
        categoryId: (await resolveCategoryId(input.categoryName)) ?? null,
        userId,
      });
      return {
        text: `Added: ${describeTransaction(transaction)}`,
        transactionId: transaction.id,
      };
    },
  });

  registerSafeTool({
    server,
    actor,
    name: 'update_transaction',
    config: {
      title: 'Update a transaction',
      description:
        'Changes one transaction, found by id (from find_transactions). Only the fields given change; the rest are kept. Changing the category also teaches My Expenses to file that description there next time.',
      inputSchema: updateTransactionShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handler: async (input) => {
      const [existing, namedCategoryId] = await Promise.all([
        requireTransaction({ id: input.id, userId }),
        resolveCategoryId(input.categoryName),
      ]);
      const updated = await transactionService.updateTransaction(
        existing.id,
        {
          description: input.description ?? existing.description,
          ...toUpdatedAmountInput({ input, existing }),
          categoryId: namedCategoryId ?? existing.category.id,
          type: input.type ?? existing.type,
          date: toTransactionDate({ day: input.date, fallback: existing.date }),
        },
        userId,
      );
      return {
        text: `Updated: ${describeTransaction(updated)}`,
        transactionId: updated.id,
      };
    },
  });

  registerSafeTool({
    server,
    actor,
    name: 'delete_transaction',
    config: {
      title: 'Delete a transaction',
      description:
        'Permanently deletes one transaction, found by id (from find_transactions). It cannot be undone, so first show the user the transaction and get an explicit yes.',
      inputSchema: deleteTransactionShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handler: async (input) => {
      const existing = await requireTransaction({ id: input.id, userId });
      await transactionService.deleteTransaction(existing.id, userId);
      return {
        text: `Deleted: ${describeTransaction(existing)}`,
        transactionId: existing.id,
      };
    },
  });
}

function toTransactionDate({
  day,
  fallback,
}: {
  day: string | undefined;
  fallback: Date;
}): Date {
  return day ? new Date(day) : fallback;
}

// The resolved subtree is rooted at the named category itself, which is the
// one a transaction gets filed under.
async function resolveCategoryId(
  categoryName: string | undefined,
): Promise<string | undefined> {
  const category = await financeQueryService.resolveCategory(categoryName);
  return category?.ids[0];
}

async function requireTransaction({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<Transaction> {
  const transaction = await transactionService.getTransactionItem(id, userId);
  if (!transaction) {
    throw new HttpError(
      404,
      `No transaction with id ${id}. Use find_transactions to look it up.`,
    );
  }
  return transaction;
}

// The conversion itself stays with currencyConversionService; this only says
// which of its inputs the agent stated.
function toAmountInput({
  amount,
  currency,
  ilsAmount,
}: AgentAmountInput): TransactionAmountInput {
  if (!isForeignCurrency(currency)) {
    if (ilsAmount !== undefined) {
      throw new CustomValidationError(
        `ilsAmount is only for a foreign-currency charge (currency: ${currency ?? BASE_CURRENCY}); put the ${BASE_CURRENCY} amount in amount`,
      );
    }
    return { currency: BASE_CURRENCY, value: amount };
  }
  return { currency, originalAmount: amount, value: ilsAmount };
}

// Untouched amount fields are passed back as stored, so an edit that leaves
// currency, amount and day alone keeps its conversion.
function toUpdatedAmountInput({
  input,
  existing,
}: {
  input: UpdateTransactionInput;
  existing: Transaction;
}): TransactionAmountInput {
  const changesCurrency =
    input.currency !== undefined && input.currency !== existing.currency;
  const lacksAmountInNewCurrency =
    changesCurrency && input.amount === undefined;
  if (lacksAmountInNewCurrency) {
    throw new CustomValidationError(
      `Changing the currency from ${existing.currency} to ${input.currency} needs the amount in ${input.currency}`,
    );
  }
  const changesAmount =
    input.amount !== undefined ||
    changesCurrency ||
    input.ilsAmount !== undefined;
  if (!changesAmount) {
    return {
      currency: existing.currency,
      originalAmount: existing.originalAmount,
    };
  }
  return toAmountInput({
    amount: input.amount ?? existing.originalAmount,
    currency: input.currency ?? existing.currency,
    ilsAmount: input.ilsAmount,
  });
}
