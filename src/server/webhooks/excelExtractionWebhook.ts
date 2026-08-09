import logger from '@/server/logging/logger';
import {
  verifyWebhookToken,
  extractWebhookParams,
} from '@/server/utils/webhookAuth';
import { ExcelExtractionWebhookPayload } from '@/server/clients/excelExtractionAgentClientTypes';
import { importRepository } from '@/server/repositories/importRepository';
import { importedTransactionRepository } from '@/server/repositories/importedTransactionRepository';
import {
  ImportStatus,
  TransactionType,
  ImportBankSourceType,
} from '@prisma/client';
import prisma from '@/server/db/client';
import { importService } from '@/server/services/importService';

export interface WebhookResult {
  status: number;
  body: { success: boolean; message?: string; error?: string };
}

export async function processExcelExtractionWebhook(
  payload: ExcelExtractionWebhookPayload,
  query: Record<string, string>,
): Promise<WebhookResult> {
  try {
    logger.info(
      { requestId: payload.requestId, status: payload.status },
      'Received excel extraction webhook',
    );

    const authParams = extractWebhookParams(query);
    if (!authParams) {
      logger.error(
        { requestId: payload.requestId },
        'Missing authentication parameters in webhook',
      );
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
        { requestId: payload.requestId, userId: authParams.userId },
        'Invalid webhook authentication',
      );
      return {
        status: 401,
        body: { success: false, error: 'Invalid authentication' },
      };
    }

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
      { err, requestId: payload.requestId },
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
  payload: ExcelExtractionWebhookPayload,
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

  const transactions = result.transactions.map((transaction) => {
    // Extraction dates arrive as DD/MM/YYYY.
    const [day, month, year] = transaction.date.split('/').map(Number);
    const date = new Date(year, month - 1, day);

    return {
      description: transaction.description,
      value: transaction.value,
      date,
      type: transaction.type as TransactionType,
      rawData: transaction.rawData || {},
      matchingTransactionId: null,
      importId,
    };
  });

  const importRecord = await importRepository.findById(importId);
  if (!importRecord) {
    throw new Error(`Import record not found: ${importId}`);
  }

  await prisma.import.update({
    where: { id: importId },
    data: {
      creditCardLastFourDigits: result.metadata.creditCardLastFour,
      paymentMonth: result.metadata.paymentMonth,
      bankSourceType: result.metadata
        .bankSourceType as ImportBankSourceType | null,
    },
  });

  // A previous import for the same card and month means this one is a
  // duplicate upload: merge new transactions into it and drop this record.
  const existingImport = await importRepository.findExisting(
    importRecord.userId,
    result.metadata.paymentMonth,
    result.metadata.creditCardLastFour,
  );

  let finalImportId = importId;
  let shouldDeleteCurrentImport = false;

  if (existingImport && existingImport.id !== importId) {
    logger.info(
      {
        currentImportId: importId,
        existingImportId: existingImport.id,
        paymentMonth: result.metadata.paymentMonth,
        creditCardLastFour: result.metadata.creditCardLastFour,
      },
      'Found duplicate import, merging transactions',
    );

    const nonDuplicateTransactions =
      await importedTransactionRepository.filterDuplicates(
        existingImport.id,
        transactions.map((transaction) => ({
          ...transaction,
          userId: importRecord.userId,
        })),
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

    finalImportId = existingImport.id;
    shouldDeleteCurrentImport = true;
  }

  if (transactions.length > 0 && !shouldDeleteCurrentImport) {
    await importedTransactionRepository.createMany(
      transactions.map((transaction) => ({
        ...transaction,
        userId: importRecord.userId,
      })),
    );
  }

  try {
    await importService.findPotentialMatchesForImport(
      finalImportId,
      importRecord.userId,
    );
  } catch (err) {
    // Matching is best-effort; the import itself already succeeded.
    logger.error(
      { importId: finalImportId, err },
      'Error finding potential matches for import',
    );
  }

  if (shouldDeleteCurrentImport) {
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

async function handleFailedExtraction(
  importId: string,
  payload: ExcelExtractionWebhookPayload,
): Promise<void> {
  const errorMessage = payload.error || 'Unknown extraction error';

  logger.error({ importId, error: errorMessage }, 'Processing failed extraction');

  await importRepository.updateStatus(
    importId,
    ImportStatus.FAILED,
    errorMessage,
  );
}
