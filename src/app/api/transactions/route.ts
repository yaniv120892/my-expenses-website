import { createHandler } from '@/server/http/handler';
import {
  createTransactionSchema,
  getTransactionsSchema,
} from '@/shared/schemas/transactions';
import transactionService from '@/server/services/transactionService';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ req, userId }) => {
    // Parsed here because the schema's input (query strings) differs from its
    // output, which the factory's single-generic ZodType cannot express.
    const query = getTransactionsSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    return transactionService.getTransactions({
      ...query,
      transactionType: query.type,
      userId,
    });
  },
});

export const POST = createHandler({
  auth: 'session',
  bodySchema: createTransactionSchema,
  status: 201,
  handler: async ({ userId, body }) =>
    transactionService.createTransaction({
      ...body,
      date: body.date || new Date(),
      categoryId: body.categoryId || null,
      userId,
    }),
});
