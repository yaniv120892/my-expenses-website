import { createHandler } from '@/server/http/handler';
import { getTransactionsSummarySchema } from '@/shared/schemas/transactions';
import transactionService from '@/server/services/transactionService';
import { toTransactionFilters } from '@/server/http/transactionQueryFilters';

export const GET = createHandler({
  auth: 'session',
  querySchema: getTransactionsSummarySchema,
  handler: async ({ userId, query }) =>
    transactionService.getCategoryBreakdown(
      toTransactionFilters(query, userId),
    ),
});
