import { z } from 'zod';
import logger from '@/server/logging/logger';
import {
  verifyWebhookToken,
  extractWebhookParams,
} from '@/server/utils/webhookAuth';
import { importRepository } from '@/server/repositories/importRepository';
import { importedTransactionRepository } from '@/server/repositories/importedTransactionRepository';
import { ImportStatus, ImportBankSourceType } from '@prisma/client';
import prisma from '@/server/db/client';
import { importService } from '@/server/services/importService';

export interface WebhookResult {
  status: number;
  body: { success: boolean; message?: string; error?: string };
}

// Enough to find the import this callback is about, and nothing more: the
// result is validated separately, after the import is in hand, so a shape
// drift can be recorded against it instead of vanishing into a 400.
const webhookEnvelopeSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(['COMPLETED', 'FAILED']),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

// Validates only what the handlers below consume; the sibling service may add
// fields freely, but a shape drift in these must fail the import, not throw a
// TypeError mid-processing. Kept tolerant on purpose — a day written 5/8/2026
// or a statement with no card digits is still worth importing.
const extractionResultSchema = z.object({
  transactions: z.array(
    z.object({
      date: z.string().regex(/^\d{1,2}\/\d{1,2}\/\d{4}$/),
      description: z.string(),
      value: z.number(),
      type: z.enum(['EXPENSE', 'INCOME']),
      rawData: z
        .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .optional(),
    }),
  ),
  metadata: z.object({
    creditCardLastFour: z.string().nullish(),
    bankSourceType: z
      .enum(['BANK_CREDIT', 'NON_BANK_CREDIT', 'UNKNOWN'])
      .nullish(),
    paymentMonth: z.string().nullish(),
  }),
});

type WebhookPayload = z.infer<typeof webhookEnvelopeSchema>;
type ExtractionResult = z.infer<typeof extractionResultSchema>;
type ExtractionMetadata = ExtractionResult['metadata'];
type ImportedTransactionRow = ReturnType<
  typeof toImportedTransactionRows
>[number];

export async function processExcelExtractionWebhook(
  rawPayload: unknown,
  query: Record<string, string>,
): Promise<WebhookResult> {
  let payload: WebhookPayload | undefined;
  let importId: string | undefined;
  try {
    const authParams = extractWebhookParams(query);
    if (!authParams) {
      logger.error({}, 'Missing authentication parameters in webhook');
      return {
        status: 401,
        body: { success: false, error: 'Missing authentication parameters' },
      };
    }

    const isValid = verifyWebhookToken(
      authParams.token,
      authParams.userId,
      authParams.timestamp,
    );
    if (!isValid) {
      logger.error(
        { userId: authParams.userId },
        'Invalid webhook authentication',
      );
      return {
        status: 401,
        body: { success: false, error: 'Invalid authentication' },
      };
    }

    const parsed = webhookEnvelopeSchema.safeParse(rawPayload);
    if (!parsed.success) {
      logger.error(
        { userId: authParams.userId, issues: parsed.error.issues },
        'Invalid excel extraction webhook payload',
      );
      return {
        status: 400,
        body: { success: false, error: 'Invalid webhook payload' },
      };
    }
    payload = parsed.data;

    logger.info(
      { requestId: payload.requestId, status: payload.status },
      'Received excel extraction webhook',
    );

    const importRecord = await importRepository.findByExtractionRequestId(
      payload.requestId,
    );
    if (!importRecord) {
      logger.error(
        { requestId: payload.requestId },
        'Import record not found for extraction request',
      );
      return {
        status: 404,
        body: { success: false, error: 'Import record not found' },
      };
    }

    if (importRecord.userId !== authParams.userId) {
      logger.error(
        {
          requestId: payload.requestId,
          expectedUserId: importRecord.userId,
          receivedUserId: authParams.userId,
        },
        'User ID mismatch in webhook',
      );
      return {
        status: 403,
        body: { success: false, error: 'Unauthorized access' },
      };
    }

    importId = importRecord.id;

    switch (payload.status) {
      case 'COMPLETED': {
        const result = extractionResultSchema.safeParse(payload.result);
        if (!result.success) {
          // The extraction itself is unusable, so the import is finished and
          // failed. Leaving it PROCESSING would hide it from the user forever.
          logger.error(
            { importId, issues: result.error.issues },
            'Unusable extraction result in webhook',
          );
          await importRepository.updateStatus(
            importId,
            ImportStatus.FAILED,
            'The extraction service returned a result this app could not read',
          );
          return {
            status: 400,
            body: { success: false, error: 'Invalid extraction result' },
          };
        }
        await handleCompletedExtraction(importId, result.data);
        break;
      }
      case 'FAILED':
        await handleFailedExtraction(importId, payload);
        break;
      default:
        throw new Error(`Invalid webhook status: ${payload.status}`);
    }

    logger.info(
      {
        requestId: payload.requestId,
        importId: importRecord.id,
        status: payload.status,
      },
      'Webhook processed successfully',
    );
    return {
      status: 200,
      body: { success: true, message: 'Webhook processed successfully' },
    };
  } catch (err) {
    logger.error(
      { err, requestId: payload?.requestId, importId },
      'Error processing webhook',
    );
    // This callback is the only thing that ever moves an import out of
    // PROCESSING, and the sibling service does not retry, so a crash here has
    // to leave the import failed rather than pending forever.
    if (importId) {
      await markImportFailedSafe(importId);
    }
    return {
      status: 500,
      body: { success: false, error: 'Failed to process webhook' },
    };
  }
}

async function markImportFailedSafe(importId: string): Promise<void> {
  try {
    await importRepository.updateStatus(
      importId,
      ImportStatus.FAILED,
      'Processing the extraction result failed',
    );
  } catch (err) {
    logger.error({ err, importId }, 'Failed to mark import as failed');
  }
}

async function handleCompletedExtraction(
  importId: string,
  result: ExtractionResult,
): Promise<void> {
  logger.info(
    {
      importId,
      transactionCount: result.transactions.length,
      creditCardLastFour: result.metadata.creditCardLastFour,
      paymentMonth: result.metadata.paymentMonth,
    },
    'Processing completed extraction',
  );

  const transactions = toImportedTransactionRows(result, importId);

  const importRecord = await importRepository.findById(importId);
  if (!importRecord) {
    throw new Error(`Import record not found: ${importId}`);
  }

  await writeExtractionMetadata(importId, result.metadata);

  const mergedIntoImportId = await mergeIntoDuplicateImport(
    importId,
    importRecord.userId,
    result.metadata,
    transactions,
  );
  const finalImportId = mergedIntoImportId ?? importId;

  if (!mergedIntoImportId && transactions.length > 0) {
    await importedTransactionRepository.createMany(
      transactions.map((transaction) => ({
        ...transaction,
        userId: importRecord.userId,
      })),
    );
  }

  await findPotentialMatchesSafe(finalImportId, importRecord.userId);

  if (mergedIntoImportId) {
    await prisma.import.delete({ where: { id: importId } });
    logger.info(
      { deletedImportId: importId, keptImportId: finalImportId },
      'Deleted duplicate import record',
    );
  } else {
    await importRepository.updateStatus(importId, ImportStatus.COMPLETED);
  }

  logger.info(
    { importId, transactionCount: transactions.length },
    'Completed extraction processed successfully',
  );
}

function toImportedTransactionRows(result: ExtractionResult, importId: string) {
  return result.transactions.map((transaction) => {
    // Extraction dates arrive as DD/MM/YYYY.
    const [day, month, year] = transaction.date.split('/').map(Number);

    return {
      description: transaction.description,
      value: transaction.value,
      date: new Date(year, month - 1, day),
      type: transaction.type,
      rawData: transaction.rawData || {},
      matchingTransactionId: null,
      importId,
    };
  });
}

async function writeExtractionMetadata(
  importId: string,
  metadata: ExtractionMetadata,
): Promise<void> {
  await prisma.import.update({
    where: { id: importId },
    data: {
      creditCardLastFourDigits: metadata.creditCardLastFour ?? null,
      paymentMonth: metadata.paymentMonth ?? null,
      bankSourceType: (metadata.bankSourceType ??
        null) as ImportBankSourceType | null,
    },
  });
}

/**
 * A previous import for the same card and month means this one is a duplicate
 * upload, so its transactions are merged into that import. Returns the id of
 * the import that survives, or null when there was no duplicate — the caller
 * drops this import only in the former case.
 */
async function mergeIntoDuplicateImport(
  importId: string,
  userId: string,
  metadata: ExtractionMetadata,
  transactions: ImportedTransactionRow[],
): Promise<string | null> {
  // Without a card and a month there is nothing to identify a duplicate by,
  // and matching on two nulls would merge unrelated statements.
  if (!metadata.creditCardLastFour || !metadata.paymentMonth) {
    return null;
  }

  // Excluding the import being processed — the caller has just written its
  // metadata, so it would otherwise match itself and the merge never fire.
  const existingImport = await importRepository.findExisting(
    userId,
    metadata.paymentMonth,
    metadata.creditCardLastFour,
    importId,
  );
  if (!existingImport || existingImport.id === importId) {
    return null;
  }

  logger.info(
    {
      currentImportId: importId,
      existingImportId: existingImport.id,
      paymentMonth: metadata.paymentMonth,
      creditCardLastFour: metadata.creditCardLastFour,
    },
    'Found duplicate import, merging transactions',
  );

  const nonDuplicateTransactions =
    await importedTransactionRepository.filterDuplicates(
      existingImport.id,
      transactions.map((transaction) => ({ ...transaction, userId })),
    );

  if (nonDuplicateTransactions.length > 0) {
    await importedTransactionRepository.createMany(
      nonDuplicateTransactions.map((transaction) => ({
        ...transaction,
        importId: existingImport.id,
      })),
    );

    logger.info(
      {
        existingImportId: existingImport.id,
        mergedTransactionCount: nonDuplicateTransactions.length,
        totalTransactionCount: transactions.length,
      },
      'Merged non-duplicate transactions to existing import',
    );
  }

  return existingImport.id;
}

async function findPotentialMatchesSafe(
  importId: string,
  userId: string,
): Promise<void> {
  try {
    await importService.findPotentialMatchesForImport(importId, userId);
  } catch (err) {
    // Matching is best-effort; the import itself already succeeded.
    logger.error(
      { importId, err },
      'Error finding potential matches for import',
    );
  }
}

async function handleFailedExtraction(
  importId: string,
  payload: WebhookPayload,
): Promise<void> {
  const errorMessage = payload.error || 'Unknown extraction error';

  logger.error(
    { importId, error: errorMessage },
    'Processing failed extraction',
  );

  await importRepository.updateStatus(
    importId,
    ImportStatus.FAILED,
    errorMessage,
  );
}
