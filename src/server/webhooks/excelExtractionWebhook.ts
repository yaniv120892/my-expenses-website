import { z } from 'zod';
import logger from '@/server/logging/logger';
import { reportSwallowedError } from '@/server/logging/reportSwallowedError';
import {
  verifyWebhookToken,
  extractWebhookParams,
} from '@/server/utils/webhookAuth';
import { importRepository } from '@/server/repositories/importRepository';
import { importedTransactionRepository } from '@/server/repositories/importedTransactionRepository';
import { Import, ImportStatus, ImportBankSourceType } from '@prisma/client';
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

// Validates only what the handlers consume, and tolerantly: a day written
// 5/8/2026 or no card digits is still worth importing.
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

    importId = importRecord.id;

    // A redelivered callback must not re-create rows or re-run the merge.
    const claimed = await importRepository.claimExtraction(importId);
    if (!claimed) {
      logger.info(
        { requestId: payload.requestId, importId },
        'Extraction already processed for this import, ignoring redelivery',
      );
      return {
        status: 200,
        body: { success: true, message: 'Extraction already processed' },
      };
    }

    if (payload.status === 'COMPLETED') {
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
      await handleCompletedExtraction(importRecord, result.data);
    } else {
      await handleFailedExtraction(importId, payload);
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
    reportSwallowedError(
      { err, requestId: payload?.requestId, importId },
      'Error processing webhook',
    );
    // Only this callback moves an import out of PROCESSING and the service does
    // not retry, so a crash must fail the import. The claim stays taken because
    // a redelivery would insert every row again.
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
    reportSwallowedError({ err, importId }, 'Failed to mark import as failed');
  }
}

async function handleCompletedExtraction(
  importRecord: Import,
  result: ExtractionResult,
): Promise<void> {
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
  const metadata = reconcileMetadata(importRecord, result.metadata);

  await writeExtractionMetadata(importId, metadata);

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
    metadata,
  );
  const finalImportId = mergedIntoImportId ?? importId;

  await findPotentialMatchesSafe(finalImportId, importRecord.userId);

  // COMPLETED tells a poller the preview is now the whole story.
  await importRepository.updateStatus(finalImportId, ImportStatus.COMPLETED);

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

/**
 * The submitted payment month wins: the caller names the billing month, while
 * extraction infers it and may return a transaction month or null, which must
 * not wipe a month that identifies duplicate imports.
 */
function reconcileMetadata(
  importRecord: Import,
  extracted: ExtractionMetadata,
): ExtractionMetadata {
  const submittedMonth = importRecord.paymentMonth;
  const extractedMonth = extracted.paymentMonth ?? null;
  if (!submittedMonth) {
    return extracted;
  }

  if (extractedMonth && extractedMonth !== submittedMonth) {
    logger.warn(
      { importId: importRecord.id, submittedMonth, extractedMonth },
      'Extraction reported a different payment month than the import was submitted with; keeping the submitted one',
    );
  }

  return { ...extracted, paymentMonth: submittedMonth };
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
      bankSourceType: toImportBankSourceType(metadata.bankSourceType),
    },
  });
}

function toImportBankSourceType(
  extracted: ExtractionMetadata['bankSourceType'],
): ImportBankSourceType | null {
  switch (extracted) {
    case 'BANK_CREDIT':
      return ImportBankSourceType.BANK_CREDIT;
    case 'NON_BANK_CREDIT':
      return ImportBankSourceType.NON_BANK_CREDIT;
    case 'UNKNOWN':
    case null:
    case undefined:
      return null;
    default:
      throw new Error(`Unhandled bankSourceType: ${extracted satisfies never}`);
  }
}

/**
 * Moves this duplicate's rows into an older COMPLETED import for the same card
 * and month, returning the survivor's id or null.
 */
async function mergeIntoDuplicateImport(
  importId: string,
  userId: string,
  createdAt: Date,
  metadata: ExtractionMetadata,
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
  // findExisting already excludes this import, and returns the globally oldest
  // match — which may still be younger than this one, so the check stands.
  if (!existingImport) {
    return null;
  }

  const isOlder =
    existingImport.createdAt < createdAt ||
    (existingImport.createdAt.getTime() === createdAt.getTime() &&
      existingImport.id < importId);
  if (!isOlder) {
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

  const ownRows = await importedTransactionRepository.findByImportId(importId);
  const nonDuplicateRows = await importedTransactionRepository.filterDuplicates(
    existingImport.id,
    ownRows,
  );

  // One batch, so nothing observes rows reparented under an unmerged import;
  // the survivor is held out of COMPLETED until the moved rows are matched.
  await prisma.$transaction([
    ...importedTransactionRepository.moveToImportOps(
      nonDuplicateRows.map((row) => row.id),
      existingImport.id,
    ),
    importedTransactionRepository.deleteByImportIdOp(importId),
    prisma.import.update({
      where: { id: existingImport.id },
      data: { status: ImportStatus.REMATCHING },
    }),
    prisma.import.update({
      where: { id: importId },
      data: {
        status: ImportStatus.MERGED,
        mergedIntoImportId: existingImport.id,
        completedAt: new Date(),
      },
    }),
  ]);

  logger.info(
    {
      mergedImportId: importId,
      keptImportId: existingImport.id,
      mergedTransactionCount: nonDuplicateRows.length,
      totalTransactionCount: ownRows.length,
    },
    'Merged non-duplicate transactions into the older import',
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
    reportSwallowedError(
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
