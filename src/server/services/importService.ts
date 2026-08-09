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
  categoryId: string;
}

class ImportService {
  private getAiProvider = lazy(() => AIServiceFactory.getAIService());

  public async processImport(
    fileUrl: string,
    userId: string,
    originalFileName: string,
    paymentMonthFromRequest?: string,
  ): Promise<Import> {
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

      try {
        const extractionResponse =
          await excelExtractionAgentClient.submitExtractionRequest({
            fileUrl,
            filename: originalFileName,
            userId,
            options: {
              confidenceThreshold: 0.7,
              maxRetries: 3,
              includeRawData: false,
            },
          });

        logger.info(
          {
            importId: importRecord.id,
            extractionRequestId: extractionResponse.requestId,
          },
          'Extraction request submitted',
        );

        await importRepository.updateStatus(
          importRecord.id,
          ImportStatus.PROCESSING,
        );

        await this.updateImportWithExtractionRequestId(
          importRecord.id,
          extractionResponse.requestId,
        );

        return importRecord;
      } catch (error) {
        logger.error(
          { importId: importRecord.id, err: error },
          'Failed to submit extraction request',
        );

        await importRepository.updateStatus(
          importRecord.id,
          ImportStatus.FAILED,
          getErrorMessage(error, 'Failed to submit extraction request'),
        );

        throw error;
      }
    } catch (error) {
      logger.error({ err: error }, 'Error processing import');
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
      throw new Error(
        'Imported transaction not found with id: ' +
          importedTransactionId +
          ' and userId: ' +
          userId,
      );
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
      throw new Error(
        'Imported transaction not found with id: ' +
          importedTransactionId +
          ' and userId: ' +
          userId,
      );
    }

    if (!importedTransaction.matchingTransactionId) {
      throw new Error(
        'No matching transaction found to merge with; importedTransactionId: ' +
          importedTransactionId +
          ' and userId: ' +
          userId,
      );
    }

    const matchingTransaction = await transactionRepository.getTransactionItem(
      importedTransaction.matchingTransactionId,
      userId,
    );

    if (!matchingTransaction) {
      throw new Error(
        'Matching transaction not found with id: ' +
          importedTransaction.matchingTransactionId +
          ' and userId: ' +
          userId,
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

    const result: BatchResult = {
      total: pendingTransactions.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (const transaction of pendingTransactions) {
      try {
        if (transaction.matchingTransactionId) {
          // The query that loaded these rows includes the matched transaction,
          // which the row's declared type does not describe.
          const matchingTx = (
            transaction as { matchingTransaction?: { categoryId?: string } }
          ).matchingTransaction;
          await this.mergeImportedTransaction(transaction.id, userId, {
            description: transaction.description,
            value: transaction.value,
            date: transaction.date,
            type: transaction.type,
            categoryId:
              matchingTx?.categoryId || transaction.matchingTransactionId,
          });
        } else {
          await this.approveImportedTransaction(transaction.id, userId, {
            description: transaction.description,
            value: transaction.value,
            date: transaction.date,
            type: transaction.type,
            categoryId: null,
          });
        }
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

    const result: BatchResult = {
      total: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (const transaction of pendingTransactions) {
      const matchingRule = rules.find((rule) =>
        transaction.description
          .toLowerCase()
          .includes(rule.descriptionPattern.toLowerCase()),
      );

      if (!matchingRule) continue;

      result.total++;
      try {
        if (transaction.matchingTransactionId) {
          await this.mergeImportedTransaction(transaction.id, userId, {
            description: transaction.description,
            value: transaction.value,
            date: transaction.date,
            type: transaction.type,
            categoryId: matchingRule.categoryId,
          });
        } else {
          await this.approveImportedTransaction(transaction.id, userId, {
            description: transaction.description,
            value: transaction.value,
            date: transaction.date,
            type: transaction.type,
            categoryId: matchingRule.categoryId,
          });
        }
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

  public async rematchImport(importId: string, userId: string): Promise<void> {
    const importRecord = await importRepository.findById(importId);
    if (
      !importRecord ||
      importRecord.userId !== userId ||
      importRecord.deleted
    ) {
      throw new Error('Import not found');
    }

    if (importRecord.status !== ImportStatus.COMPLETED) {
      throw new Error('Import must be in COMPLETED status to re-match');
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
      throw new Error('No pending transactions to re-match');
    }

    await importRepository.updateStatus(importId, ImportStatus.REMATCHING);

    try {
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

      for (const transaction of pendingTransactions) {
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
            'Error re-matching transaction',
          );
        }
      }

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

      await Promise.all(
        importedTransactions.map(async (transaction) => {
          try {
            await this.matchSingleTransaction(transaction, userId);
          } catch (error) {
            logger.error(
              { transactionId: transaction.id, err: error },
              'Error finding match for transaction',
            );
          }
        }),
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
