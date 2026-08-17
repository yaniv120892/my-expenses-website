import { createHandler } from '@/server/http/handler';
import { getTransactionsSummarySchema } from '@/shared/schemas/transactions';
import transactionService from '@/server/services/transactionService';
import { toTransactionFilters } from '@/server/http/transactionQueryFilters';

// The Express route responded 201 to this GET; kept for parity.
export const GET = createHandler({
  auth: 'session',
  querySchema: getTransactionsSummarySchema,
  status: 201,
  handler: async ({ userId, query }) =>
    transactionService.getTransactionsSummary(
      toTransactionFilters(query, userId),
    ),
});
