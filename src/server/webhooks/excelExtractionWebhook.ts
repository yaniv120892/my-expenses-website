import { z } from 'zod';
import logger from '@/server/logging/logger';
import {
  verifyWebhookToken,
  extractWebhookParams,
} from '@/server/utils/webhookAuth';
import { importRepository } from '@/server/repositories/importRepository';
import { importedTransactionRepository } from '@/server/repositories/importedTransactionRepository';
import { Import, ImportStatus, ImportBankSourceType } from '@prisma/client';
import prisma from '@/server/db/client';
import { importService } from '@/server/services/importService';
import { getErrorMessage } from '@/server/utils/errorUtils';

export interface WebhookResult {
  status: number;
  body: { success: boolean; message?: string; error?: string };
}

// Validates only what the handlers below consume; the sibling service may add
// fields freely, but a shape drift in these must become a 400, not a
// TypeError mid-processing.
const webhookPayloadSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(['COMPLETED', 'FAILED']),
  result: z
    .object({
      transactions: z.array(
        z.object({
          date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
          description: z.string(),
          value: z.number(),
          type: z.enum(['EXPENSE', 'INCOME']),
          rawData: z.record(z.union([z.string(), z.number()])).optional(),
        }),
      ),
      metadata: z.object({
        creditCardLastFour: z.string(),
        bankSourceType: z
          .enum(['BANK_CREDIT', 'NON_BANK_CREDIT', 'UNKNOWN'])
          .nullish(),
        paymentMonth: z.string(),
      }),
    })
    .optional(),
  error: z.string().optional(),
});

type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
type ExtractionResult = NonNullable<WebhookPayload['result']>;
type ExtractionMetadata = ExtractionResult['metadata'];

export async function processExcelExtractionWebhook(
  rawPayload: unknown,
  query: Record<string, string>,
): Promise<WebhookResult> {
  let payload: WebhookPayload | undefined;
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
      authParams.importId,
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

    const parsed = webhookPayloadSchema.safeParse(rawPayload);
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

    // The signed importId resolves the callback without depending on the
    // requestId having been persisted yet; the lookup by requestId remains for
    // callbacks issued before importId was part of the webhook URL.
    const importRecord = authParams.importId
      ? await importRepository.findById(authParams.importId)
      : await importRepository.findByExtractionRequestId(payload.requestId);
    if (!importRecord) {
      logger.error(
        { requestId: payload.requestId, importId: authParams.importId },
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

    // A redelivered callback must not re-create rows or re-run the merge.
    const claimed = await importRepository.claimExtraction(importRecord.id);
    if (!claimed) {
      logger.info(
        { requestId: payload.requestId, importId: importRecord.id },
        'Extraction already processed for this import, ignoring redelivery',
      );
      return {
        status: 200,
        body: { success: true, message: 'Extraction already processed' },
      };
    }

    try {
      if (payload.status === 'COMPLETED') {
        await handleCompletedExtraction(importRecord, payload);
      } else {
        await handleFailedExtraction(importRecord.id, payload);
      }
    } catch (err) {
      // The claim stays: this handler is not idempotent — a failure after
      // createMany would have a redelivery insert every row a second time.
      // Recording FAILED is what stops the import sitting in PROCESSING with
      // nothing to show for it; recovering means deleting and re-importing.
      await importRepository.updateStatus(
        importRecord.id,
        ImportStatus.FAILED,
        getErrorMessage(err, 'Failed to process extraction result'),
      );
      throw err;
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
      { err, requestId: payload?.requestId },
      'Error processing webhook',
    );
    return {
      status: 500,
      body: { success: false, error: 'Failed to process webhook' },
    };
  }
}

async function handleCompletedExtraction(
  importRecord: Import,
  payload: WebhookPayload,
): Promise<void> {
  if (!payload.result) {
    throw new Error('Missing extraction result in completed webhook');
  }

  const { result } = payload;
  const importId = importRecord.id;

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

  await writeExtractionMetadata(importId, result.metadata);

  // Rows are written to their own import first so that a concurrent callback
  // merging into this one sees them and can de-duplicate against them.
  if (transactions.length > 0) {
    await importedTransactionRepository.createMany(
      transactions.map((transaction) => ({
        ...transaction,
        userId: importRecord.userId,
      })),
    );
  }

  const mergedIntoImportId = await mergeIntoDuplicateImport(
    importId,
    importRecord.userId,
    importRecord.createdAt,
    result.metadata,
  );
  const finalImportId = mergedIntoImportId ?? importId;

  await findPotentialMatchesSafe(finalImportId, importRecord.userId);

  if (!mergedIntoImportId) {
    await importRepository.updateStatus(importId, ImportStatus.COMPLETED);
  }

  logger.info(
    { importId, finalImportId, transactionCount: transactions.length },
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
      creditCardLastFourDigits: metadata.creditCardLastFour,
      paymentMonth: metadata.paymentMonth,
      bankSourceType: (metadata.bankSourceType ??
        null) as ImportBankSourceType | null,
    },
  });
}

/**
 * An older import for the same card and month means this one is a duplicate
 * upload, so its rows are moved into that import and this import is dropped.
 * Returns the id of the import that survives, or null when there was no
 * duplicate.
 *
 * A merge target must be strictly older *and* already COMPLETED (findExisting
 * enforces the latter). Older keeps the direction deterministic so two
 * callbacks cannot delete each other; COMPLETED means the target has finished
 * writing its own rows, so de-duplicating against it is meaningful. Two
 * callbacks racing each other therefore both survive as separate imports
 * rather than one silently duplicating every row into the other.
 */
async function mergeIntoDuplicateImport(
  importId: string,
  userId: string,
  createdAt: Date,
  metadata: ExtractionMetadata,
): Promise<string | null> {
  // Excluding the import being processed — the caller has just written its
  // metadata, so it would otherwise match itself and the merge never fire.
  const existingImport = await importRepository.findExisting(
    userId,
    metadata.paymentMonth,
    metadata.creditCardLastFour,
    importId,
  );
  // findExisting already excludes this import, and returns the globally oldest
  // match — which may still be younger than this one, so the check stands.
  if (!existingImport) return null;

  const isOlder =
    existingImport.createdAt < createdAt ||
    (existingImport.createdAt.getTime() === createdAt.getTime() &&
      existingImport.id < importId);
  if (!isOlder) return null;

  logger.info(
    {
      currentImportId: importId,
      existingImportId: existingImport.id,
      paymentMonth: metadata.paymentMonth,
      creditCardLastFour: metadata.creditCardLastFour,
    },
    'Found duplicate import, merging transactions',
  );

  const ownRows = await importedTransactionRepository.findByImportId(importId);
  const nonDuplicateRows = await importedTransactionRepository.filterDuplicates(
    existingImport.id,
    ownRows,
  );

  // One batch, so a failure between the move and the delete cannot leave the
  // rows reparented under an import that still exists. Whatever is not moved
  // is by definition already present in the survivor, and would block the
  // delete anyway — the FK is Restrict.
  await prisma.$transaction([
    ...importedTransactionRepository.moveToImportOps(
      nonDuplicateRows.map((row) => row.id),
      existingImport.id,
    ),
    importedTransactionRepository.deleteByImportIdOp(importId),
    prisma.import.delete({ where: { id: importId } }),
  ]);

  logger.info(
    {
      deletedImportId: importId,
      keptImportId: existingImport.id,
      mergedTransactionCount: nonDuplicateRows.length,
      totalTransactionCount: ownRows.length,
    },
    'Merged non-duplicate transactions and deleted duplicate import',
  );

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
