import { createHandler } from '@/server/http/handler';
import { toTransactionFilters } from '@/server/http/transactionQueryFilters';
import { exportTransactionsSchema } from '@/shared/schemas/transactions';
import transactionService from '@/server/services/transactionService';
import {
  CSV_BOM,
  buildTransactionsCsv,
  transactionsCsvFileName,
} from '@/server/utils/transactionCsv';
import logger from '@/server/logging/logger';

// Walking every page of a long history takes longer than the default budget.
export const maxDuration = 60;

export const GET = createHandler({
  auth: 'session',
  querySchema: exportTransactionsSchema,
  handler: async ({ userId, query }) => {
    const startedAt = Date.now();
    const transactions = await transactionService.getAllTransactions(
      toTransactionFilters(query, userId),
    );

    logger.info(
      {
        userId,
        rowCount: transactions.length,
        durationMs: Date.now() - startedAt,
      },
      'Exported transactions CSV',
    );

    const csv = `${CSV_BOM}${buildTransactionsCsv(transactions)}`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${transactionsCsvFileName(query)}"`,
        'Cache-Control': 'no-store',
      },
    });
  },
});
