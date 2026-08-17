import { createHandler } from '@/server/http/handler';
import { toTransactionFilters } from '@/server/http/transactionQueryFilters';
import { exportTransactionsSchema } from '@/shared/schemas/transactions';
import transactionService from '@/server/services/transactionService';
import {
  buildTransactionsCsvFile,
  transactionsCsvFileName,
} from '@/server/utils/transactionCsv';
import logger from '@/server/logging/logger';
import { HttpError } from '@/server/http/errors';

// Walking every page of a long history takes longer than the default budget.
export const maxDuration = 60;

// The filters are all optional, so an export can ask for the whole history and
// hold it in memory. The walk stops one row past this, so an oversized export
// gets a legible error instead of a maxDuration timeout the client can only
// report as "failed".
const MAX_EXPORT_ROWS = 50_000;

export const GET = createHandler({
  auth: 'session',
  querySchema: exportTransactionsSchema,
  handler: async ({ userId, query }) => {
    const startedAt = Date.now();
    const transactions = await transactionService.getAllTransactions(
      toTransactionFilters(query, userId),
      { maxRows: MAX_EXPORT_ROWS },
    );

    if (transactions.length > MAX_EXPORT_ROWS) {
      throw new HttpError(
        413,
        `That export is too large (over ${MAX_EXPORT_ROWS.toLocaleString()} transactions). Narrow the date range and try again.`,
      );
    }

    logger.info(
      {
        userId,
        rowCount: transactions.length,
        durationMs: Date.now() - startedAt,
      },
      'Exported transactions CSV',
    );

    return new Response(buildTransactionsCsvFile(transactions), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${transactionsCsvFileName(query)}"`,
        'Cache-Control': 'no-store',
      },
    });
  },
});
