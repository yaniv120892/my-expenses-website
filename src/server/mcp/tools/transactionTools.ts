import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import financeQueryService from '@/server/services/assistant/financeQueries';
import transactionService from '@/server/services/transactionService';
import { CustomValidationError } from '@/server/errors/validationError';
import { HttpError } from '@/server/http/errors';
import { BASE_CURRENCY, isForeignCurrency } from '@/shared/currency';
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
import type {
  AddTransactionInput,
  AgentAmountInput,
  DeleteTransactionInput,
  FindTransactionsInput,
  McpActor,
  UpdateTransactionInput,
} from '@/server/mcp/toolSchemas.types';
import { toolSuccess, withToolErrorHandling } from '@/server/mcp/toolResult';
import {
  describeTransaction,
  describeTransactions,
} from '@/server/mcp/transactionText';

export function registerTransactionTools(
  server: McpServer,
  { userId }: McpActor,
): void {
  server.registerTool(
    'find_transactions',
    {
      title: 'Find transactions',
      description:
        'Lists individual approved transactions matching the filters, newest first, one per line as "id | date | description | amount | category | type". Use it to show the user specific transactions and to find the id before updating or deleting one. Amounts are in ILS; a foreign charge shows its original amount first, e.g. "$25.00 · ₪92.35".',
      inputSchema: findTransactionsShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withToolErrorHandling({
      toolName: 'find_transactions',
      userId,
      handler: async (input: FindTransactionsInput) => {
        const transactions = await findTransactions({ userId, input });
        return toolSuccess(
          describeTransactions({
            transactions,
            emptyText: 'No transactions match those filters.',
          }),
        );
      },
    }),
  );

  server.registerTool(
    'add_transaction',
    {
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
    withToolErrorHandling({
      toolName: 'add_transaction',
      userId,
      handler: async (input: AddTransactionInput) => {
        const created = await transactionService.createTransaction({
          description: input.description,
          ...toAmountInput(input),
          type: input.type,
          date: input.date ? new Date(input.date) : new Date(),
          categoryId: (await resolveCategoryId(input.categoryName)) ?? null,
          userId,
        });
        const stored = await requireTransaction({ id: created.id, userId });
        return toolSuccess(`Added: ${describeTransaction(stored)}`);
      },
    }),
  );

  server.registerTool(
    'update_transaction',
    {
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
    withToolErrorHandling({
      toolName: 'update_transaction',
      userId,
      handler: async (input: UpdateTransactionInput) => {
        const existing = await requireTransaction({ id: input.id, userId });
        const categoryId =
          (await resolveCategoryId(input.categoryName)) ?? existing.category.id;
        await transactionService.updateTransaction(
          existing.id,
          {
            description: input.description ?? existing.description,
            ...toUpdatedAmountInput({ input, existing }),
            categoryId,
            type: input.type ?? existing.type,
            date: input.date ? new Date(input.date) : existing.date,
          },
          userId,
        );
        const updated = await requireTransaction({ id: existing.id, userId });
        return toolSuccess(`Updated: ${describeTransaction(updated)}`);
      },
    }),
  );

  server.registerTool(
    'delete_transaction',
    {
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
    withToolErrorHandling({
      toolName: 'delete_transaction',
      userId,
      handler: async (input: DeleteTransactionInput) => {
        const existing = await requireTransaction({ id: input.id, userId });
        await transactionService.deleteTransaction(existing.id, userId);
        return toolSuccess(`Deleted: ${describeTransaction(existing)}`);
      },
    }),
  );
}

async function findTransactions({
  userId,
  input,
}: {
  userId: string;
  input: FindTransactionsInput;
}): Promise<Transaction[]> {
  const category = await financeQueryService.resolveCategory(
    input.categoryName,
  );
  const page = await transactionService.getTransactionsList({
    userId,
    limit: input.limit,
    ...(input.startDate ? { startDate: new Date(input.startDate) } : {}),
    ...(input.endDate ? { endDate: new Date(input.endDate) } : {}),
    ...(input.transactionType
      ? { transactionType: input.transactionType }
      : {}),
    ...(input.searchTerm ? { searchTerm: input.searchTerm } : {}),
    ...(category ? { categoryIds: category.ids } : {}),
  });
  return page.items;
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
  if (changesCurrency && input.amount === undefined) {
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
