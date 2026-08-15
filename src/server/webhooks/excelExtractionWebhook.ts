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
type ImportedTransactionRow = ReturnType<
  typeof toImportedTransactionRows
>[number];

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

    switch (payload.status) {
      case 'COMPLETED':
        await handleCompletedExtraction(importRecord.id, payload);
        break;
      case 'FAILED':
        await handleFailedExtraction(importRecord.id, payload);
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
  importId: string,
  payload: WebhookPayload,
): Promise<void> {
  if (!payload.result) {
    throw new Error('Missing extraction result in completed webhook');
  }

  const { result } = payload;

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
      creditCardLastFourDigits: metadata.creditCardLastFour,
      paymentMonth: metadata.paymentMonth,
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
