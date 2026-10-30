import { createHandler } from '@/server/http/handler';
import { createTransactionSchema, getTransactionsSchema } from '@/shared/schemas/transactions';
import transactionService from '@/server/services/transactionService';
import type { CreateTransactionResult } from '@/shared/types/transaction';
import { toTransactionFilters } from '@/server/http/transactionQueryFilters';
import { captureProductEvent } from '@/server/productEvents';

export const GET = createHandler({
  auth: 'session',
  querySchema: getTransactionsSchema,
  handler: async ({ actor, query }) =>
    transactionService.getTransactionsList(actor.householdId, toTransactionFilters(query)),
});

export const POST = createHandler({
  auth: 'session',
  bodySchema: createTransactionSchema,
  status: 201,
  handler: async ({ userId, actor, body }): Promise<CreateTransactionResult> => {
    const { id, suggestedCategory } = await transactionService.createTransaction(actor, {
      ...body,
      date: body.date ?? null,
      categoryId: body.categoryId || null,
    });
    captureProductEvent({ userId, event: 'transaction_created', properties: { channel: 'web' } });
    return { id, ...(suggestedCategory && { suggestedCategory }) };
  },
});
