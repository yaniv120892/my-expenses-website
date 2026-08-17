import {
  Import,
  ImportStatus,
  TransactionType,
  TransactionStatus,
  ImportedTransactionStatus,
} from '@prisma/client';
import logger from '@/server/logging/logger';
import { getErrorMessage } from '@/server/utils/errorUtils';
import { importRepository } from '@/server/repositories/importRepository';
import { importedTransactionRepository } from '@/server/repositories/importedTransactionRepository';
import { autoApproveRuleRepository } from '@/server/repositories/autoApproveRuleRepository';
import transactionRepository from '@/server/repositories/transactionRepository';
import transactionService from '@/server/services/transactionService';
import { excelExtractionAgentClient } from '@/server/clients/excelExtractionAgentClient';
import prisma from '@/server/db/client';
import AIServiceFactory from '@/server/services/ai/aiServiceFactory';
import { lazy } from '@/server/lib/lazy';
import { requireEnv } from '@/server/env';
import { HttpError } from '@/server/http/errors';

interface BatchResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

interface ApproveImportedTransactionData {
  description: string;
  value: number;
  date: Date;
  type: TransactionType;
  categoryId: string | null;
}

interface MergeImportedTransactionData {
  description: string;
  value: number;
  date: Date;
  type: TransactionType;
  // Absent means keep the matched transaction's existing category.
  categoryId?: string;
}

interface BatchImportedTransaction {
  id: string;
  description: string;
  value: number;
  date: Date;
  type: TransactionType;
  matchingTransactionId: string | null;
}

interface BatchItem {
  transaction: BatchImportedTransaction;
  categoryId: string | null;
}

type ImportedTransactionRecord = Awaited<
  ReturnType<typeof importedTransactionRepository.findByUserIdAndImportId>
>[number];

// The extraction agent fetches this URL server-side, so accepting an arbitrary
// URL would let a user point it at internal hosts. Only files the upload
// endpoint wrote to the imports bucket are allowed.
function assertUploadedImportUrl(fileUrl: string): void {
  const importsPrefix = `https://${requireEnv('IMPORTS_S3_BUCKET')}.s3.${requireEnv('IMPORTS_S3_REGION')}.amazonaws.com/imports/`;
  if (!fileUrl.startsWith(importsPrefix)) {
    throw new HttpError(400, 'fileUrl must point to an uploaded import file');
  }
}

class ImportService {
  private getAiProvider = lazy(() => AIServiceFactory.getAIService());

  public async processImport(
    fileUrl: string,
    userId: string,
    originalFileName: string,
    paymentMonthFromRequest?: string,
  ): Promise<Import> {
    assertUploadedImportUrl(fileUrl);

    try {
      logger.info(
        {
          userId,
          originalFileName,
          fileUrl: fileUrl.substring(0, 100),
        },
        'Starting import with excel extraction agent',
      );

      const importRecord = await importRepository.create({
        fileUrl,
        originalFileName,
        userId,
        importType: null,
        bankSourceType: null,
        creditCardLastFourDigits: null,
        paymentMonth: paymentMonthFromRequest || null,
        excelExtractionRequestId: null,
      });

      logger.info(
        { importId: importRecord.id, userId },
        'Created import record',
      );

      await this.submitExtraction(
        importRecord.id,
        fileUrl,
        originalFileName,
        userId,
      );

      return importRecord;
    } catch (error) {
      logger.error({ err: error }, 'Error processing import');
      throw error;
    }
  }

  /** Marks the import FAILED before rethrowing, so a rejected submit is visible. */
  private async submitExtraction(
    importId: string,
    fileUrl: string,
    originalFileName: string,
    userId: string,
  ): Promise<void> {
    try {
      const extractionResponse =
        await excelExtractionAgentClient.submitExtractionRequest({
          fileUrl,
          filename: originalFileName,
          userId,
          importId,
          options: {
            confidenceThreshold: 0.7,
            maxRetries: 3,
            includeRawData: false,
          },
        });

      logger.info(
        { importId, extractionRequestId: extractionResponse.requestId },
        'Extraction request submitted',
      );

      await importRepository.updateStatus(importId, ImportStatus.PROCESSING);

      await this.updateImportWithExtractionRequestId(
        importId,
        extractionResponse.requestId,
      );
    } catch (error) {
      logger.error(
        { importId, err: error },
        'Failed to submit extraction request',
      );

      await importRepository.updateStatus(
        importId,
        ImportStatus.FAILED,
        getErrorMessage(error, 'Failed to submit extraction request'),
      );

      throw error;
    }
  }

  private async updateImportWithExtractionRequestId(
    importId: string,
    extractionRequestId: string,
  ): Promise<void> {
    await prisma.import.update({
      where: { id: importId },
      data: { excelExtractionRequestId: extractionRequestId },
    });
  }

  public async getImports(userId: string) {
    const imports = await importRepository.findByUserId(userId);
    return imports.map((imp) => {
      const { _count, ...importData } = imp;
      return {
        ...importData,
        isVerified: _count.transactions === 0,
      };
    });
  }

  public async getImportedTransactions(importId: string, userId: string) {
    return importedTransactionRepository.findByUserIdAndImportId(
      userId,
      importId,
    );
  }

  public async approveImportedTransaction(
    importedTransactionId: string,
    userId: string,
    transactionData: ApproveImportedTransactionData,
  ) {
    const importedTransaction = await importedTransactionRepository.findById(
      importedTransactionId,
    );

    if (!importedTransaction || importedTransaction.userId !== userId) {
      throw new HttpError(404, 'Imported transaction not found');
    }

    await importedTransactionRepository.clearMatchingTransaction(
      importedTransactionId,
      userId,
    );

    await transactionService.createTransaction({
      description: transactionData.description,
      value: transactionData.value,
      date: transactionData.date,
      type: transactionData.type,
      userId: importedTransaction.userId,
      status: TransactionStatus.APPROVED,
      categoryId: transactionData.categoryId,
    });

    await importedTransactionRepository.updateStatus(
      importedTransactionId,
      userId,
      ImportedTransactionStatus.APPROVED,
    );
  }

  public async mergeImportedTransaction(
    importedTransactionId: string,
    userId: string,
    transactionData: MergeImportedTransactionData,
  ) {
    const importedTransaction = await importedTransactionRepository.findById(
      importedTransactionId,
    );

    if (!importedTransaction || importedTransaction.userId !== userId) {
      throw new HttpError(404, 'Imported transaction not found');
    }

    if (!importedTransaction.matchingTransactionId) {
      throw new HttpError(409, 'No matching transaction to merge with');
    }

    const matchingTransaction = await transactionRepository.getTransactionItem(
      importedTransaction.matchingTransactionId,
      userId,
    );

    if (!matchingTransaction) {
      throw new HttpError(
        404,
        'Matching transaction not found with id: ' +
          importedTransaction.matchingTransactionId,
      );
    }

    await transactionService.updateTransaction(
      importedTransaction.matchingTransactionId,
      {
        description: transactionData.description,
        type: transactionData.type,
        value: transactionData.value,
        date: transactionData.date,
        categoryId: transactionData.categoryId,
      },
      userId,
    );

    if (matchingTransaction.status === TransactionStatus.PENDING_APPROVAL) {
      await transactionService.updateTransactionStatus(
        importedTransaction.matchingTransactionId,
        TransactionStatus.APPROVED,
        userId,
      );
    }

    await importedTransactionRepository.updateStatus(
      importedTransactionId,
      userId,
      ImportedTransactionStatus.MERGED,
    );
  }

  public async ignoreImportedTransaction(
    importedTransactionId: string,
    userId: string,
  ) {
    await importedTransactionRepository.updateStatus(
      importedTransactionId,
      userId,
      ImportedTransactionStatus.IGNORED,
    );
  }

  public async deleteImport(importId: string, userId: string) {
    await importRepository.softDelete(importId, userId);
  }

  public async deleteImportedTransaction(
    importedTransactionId: string,
    userId: string,
  ) {
    await importedTransactionRepository.softDelete(
      importedTransactionId,
      userId,
    );
  }

  public async batchApproveImportedTransactions(
    importId: string,
    transactionIds: string[] | 'all',
    userId: string,
  ): Promise<BatchResult> {
    const transactions =
      transactionIds === 'all'
        ? await importedTransactionRepository.findPendingByImportId(
            importId,
            userId,
          )
        : await Promise.all(
            transactionIds.map((id) =>
              importedTransactionRepository.findById(id),
            ),
          ).then((results) => results.filter((t) => t !== null));

    const pendingTransactions = transactions.filter(
      (t) =>
        t.status === ImportedTransactionStatus.PENDING && t.userId === userId,
    );

    const items = pendingTransactions.map((transaction) => {
      // The query that loaded these rows includes the matched transaction,
      // which the row's declared type does not describe.
      const matchingTx = (
        transaction as { matchingTransaction?: { categoryId?: string } }
      ).matchingTransaction;
      return {
        transaction,
        // Never fall back to the transaction id — it is not a category id.
        categoryId: matchingTx?.categoryId ?? null,
      };
    });

    return this.runMergeOrApproveBatch(items, userId);
  }

  public async batchIgnoreImportedTransactions(
    importId: string,
    transactionIds: string[] | 'all',
    userId: string,
  ): Promise<BatchResult> {
    let ids: string[];

    if (transactionIds === 'all') {
      const pending = await importedTransactionRepository.findPendingByImportId(
        importId,
        userId,
      );
      ids = pending.map((t) => t.id);
    } else {
      ids = transactionIds;
    }

    const count = await importedTransactionRepository.updateStatusBatch(
      ids,
      userId,
      ImportedTransactionStatus.IGNORED,
    );

    return {
      total: ids.length,
      succeeded: count,
      failed: ids.length - count,
      errors: [],
    };
  }

  public async applyAutoApproveRules(
    importId: string,
    userId: string,
  ): Promise<BatchResult> {
    const [pendingTransactions, rules] = await Promise.all([
      importedTransactionRepository.findPendingByImportId(importId, userId),
      autoApproveRuleRepository.findActiveByUserId(userId),
    ]);

    const items: BatchItem[] = [];
    for (const transaction of pendingTransactions) {
      const matchingRule = rules.find((rule) =>
        transaction.description
          .toLowerCase()
          .includes(rule.descriptionPattern.toLowerCase()),
      );

      if (!matchingRule) continue;

      items.push({ transaction, categoryId: matchingRule.categoryId });
    }

    return this.runMergeOrApproveBatch(items, userId);
  }

  private async runMergeOrApproveBatch(
    items: BatchItem[],
    userId: string,
  ): Promise<BatchResult> {
    const result: BatchResult = {
      total: items.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (const { transaction, categoryId } of items) {
      try {
        await this.mergeOrApprove(transaction, userId, categoryId);
        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: transaction.id,
          error: getErrorMessage(error),
        });
      }
    }

    return result;
  }

  private async mergeOrApprove(
    transaction: BatchImportedTransaction,
    userId: string,
    categoryId: string | null,
  ): Promise<void> {
    const payload = {
      description: transaction.description,
      value: transaction.value,
      date: transaction.date,
      type: transaction.type,
    };

    if (transaction.matchingTransactionId) {
      await this.mergeImportedTransaction(transaction.id, userId, {
        ...payload,
        categoryId: categoryId ?? undefined,
      });
      return;
    }

    await this.approveImportedTransaction(transaction.id, userId, {
      ...payload,
      categoryId,
    });
  }

  public async rematchImport(importId: string, userId: string): Promise<void> {
    const importRecord = await importRepository.findById(importId);
    if (
      !importRecord ||
      importRecord.userId !== userId ||
      importRecord.deleted
    ) {
      throw new HttpError(404, 'Import not found');
    }

    if (importRecord.status !== ImportStatus.COMPLETED) {
      throw new HttpError(
        409,
        'Import must be in COMPLETED status to re-match',
      );
    }

    const allTransactions =
      await importedTransactionRepository.findByUserIdAndImportId(
        userId,
        importId,
      );

    const pendingTransactions = allTransactions.filter(
      (t) => t.status === ImportedTransactionStatus.PENDING,
    );

    if (pendingTransactions.length === 0) {
      throw new HttpError(409, 'No pending transactions to re-match');
    }

    await importRepository.updateStatus(importId, ImportStatus.REMATCHING);

    try {
      await this.rematchPendingTransactions(
        importId,
        userId,
        allTransactions,
        pendingTransactions,
      );

      await importRepository.updateStatus(importId, ImportStatus.COMPLETED);

      logger.info(
        { importId, pendingCount: pendingTransactions.length },
        'Completed re-matching import',
      );
    } catch (error) {
      await importRepository.updateStatus(
        importId,
        ImportStatus.FAILED,
        getErrorMessage(error, 'Re-match failed'),
      );
      throw error;
    }
  }

  /**
   * Clears the pending rows' matches and matches them again, keeping every
   * transaction already claimed by a non-pending row out of the running so two
   * rows cannot land on the same one.
   */
  private async rematchPendingTransactions(
    importId: string,
    userId: string,
    allTransactions: ImportedTransactionRecord[],
    pendingTransactions: ImportedTransactionRecord[],
  ): Promise<void> {
    const excludedTransactionIds = new Set(
      allTransactions
        .filter(
          (t) =>
            t.status !== ImportedTransactionStatus.PENDING &&
            t.matchingTransactionId,
        )
        .map((t) => t.matchingTransactionId!),
    );

    await prisma.importedTransaction.updateMany({
      where: {
        importId,
        userId,
        status: ImportedTransactionStatus.PENDING,
      },
      data: { matchingTransactionId: null },
    });

    await this.matchSequentially(
      pendingTransactions,
      userId,
      excludedTransactionIds,
      'Error re-matching transaction',
    );
  }

  /**
   * Matches rows one at a time against a running exclusion set, so no two rows
   * can claim the same transaction. A row that throws is logged and skipped
   * rather than failing the rest.
   */
  private async matchSequentially(
    transactions: {
      id: string;
      description: string;
      date: Date;
      value: number;
    }[],
    userId: string,
    excludedTransactionIds: Set<string>,
    errorMessage: string,
  ): Promise<void> {
    for (const transaction of transactions) {
      try {
        const matchedId = await this.matchSingleTransaction(
          transaction,
          userId,
          excludedTransactionIds,
        );

        if (matchedId) {
          excludedTransactionIds.add(matchedId);
        }
      } catch (error) {
        logger.error(
          { transactionId: transaction.id, err: error },
          errorMessage,
        );
      }
    }
  }

  public async findPotentialMatchesForImport(
    importId: string,
    userId: string,
  ): Promise<void> {
    try {
      logger.info({ importId, userId }, 'Finding potential matches for import');

      const importedTransactions =
        await importedTransactionRepository.findByImportId(importId);

      logger.info(
        { importId, count: importedTransactions.length },
        'Processing imported transactions for matches',
      );

      // Seeded from every transaction this user's other pending rows already
      // claim, so a row here cannot take one out from under them.
      const excludedTransactionIds = new Set(
        await importedTransactionRepository.findClaimedMatchingTransactionIds(
          userId,
        ),
      );

      // Rows merged in from a duplicate import keep the match they already
      // hold; re-matching them would only find it excluded by itself.
      await this.matchSequentially(
        importedTransactions.filter((t) => !t.matchingTransactionId),
        userId,
        excludedTransactionIds,
        'Error finding match for transaction',
      );

      logger.info({ importId }, 'Completed finding potential matches');
    } catch (error) {
      logger.error(
        { importId, err: error },
        'Error finding potential matches for import',
      );
      throw error;
    }
  }

  private async matchSingleTransaction(
    transaction: { id: string; description: string; date: Date; value: number },
    userId: string,
    excludedIds?: Set<string>,
  ): Promise<string | null> {
    const matches = await transactionRepository.findPotentialMatches(
      userId,
      transaction.date,
      transaction.value,
    );

    const availableMatches = excludedIds
      ? matches.filter((m) => !excludedIds.has(m.id))
      : matches;

    if (availableMatches.length === 0) return null;

    const bestMatchId = await this.getAiProvider().findMatchingTransaction(
      transaction.description,
      availableMatches,
    );

    const matchingTransactionId =
      bestMatchId ?? availableMatches[0]?.id ?? null;

    if (matchingTransactionId) {
      await prisma.importedTransaction.update({
        where: { id: transaction.id },
        data: { matchingTransactionId },
      });
    }

    return matchingTransactionId;
  }
}

export const importService = new ImportService();
