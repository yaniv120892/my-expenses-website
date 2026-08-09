import { createHandler } from '@/server/http/handler';
import { getTransactionsSummarySchema } from '@/shared/schemas/transactions';
import transactionService from '@/server/services/transactionService';

// The Express route responded 201 to this GET; kept for parity.
export const GET = createHandler({
  auth: 'session',
  querySchema: getTransactionsSummarySchema,
  status: 201,
  handler: async ({ userId, query }) =>
    transactionService.getTransactionsSummary({
      ...query,
      userId,
    }),
});
