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
import { resolveMatchedTransactionId } from '@/server/services/ai/prompts';
import { lazy } from '@/server/lib/lazy';
import { requireEnv } from '@/server/env';
import { HttpError } from '@/server/http/errors';
import {
  getPrismaErrorCode,
  PRISMA_ERROR_CODES,
} from '@/server/db/prismaErrors';
import { ReconciliationPlanItem } from '@/shared/types/import';
import { findExactNormalizedMatch } from '@/server/utils/transactionMatching';

// A missing row in the approve/merge batch means a concurrent delete won the
// race. Map it back to the 404 the non-batched path used to return.
function throwImportedTransactionNotFoundOnMissingRow(err: unknown): never {
  if (getPrismaErrorCode(err) === PRISMA_ERROR_CODES.RECORD_NOT_FOUND) {
    throw new HttpError(404, 'Imported transaction not found');
  }
  throw err;
}

function throwTransactionNotFoundOnMissingRow(err: unknown): never {
  if (getPrismaErrorCode(err) === PRISMA_ERROR_CODES.RECORD_NOT_FOUND) {
    throw new HttpError(404, 'Transaction not found');
  }
  throw err;
}

interface BatchResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: { id: string; error: string }[];
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

      // The import is created PROCESSING, and the callback carries the signed
      // importId — so it can land, complete the import and even merge it away
      // before this returns. Writing anything unconditionally here would undo
      // that, so only the request id is recorded, and only while the import is
      // still waiting for its callback.
      await this.recordExtractionRequestId(
        importId,
        extractionResponse.requestId,
      );
    } catch (error) {
      logger.error(
        { importId, err: error },
        'Failed to submit extraction request',
      );

      await this.failUnprocessedImport(
        importId,
        getErrorMessage(error, 'Failed to submit extraction request'),
      );

      throw error;
    }
  }

  private async recordExtractionRequestId(
    importId: string,
    extractionRequestId: string,
  ): Promise<void> {
    await prisma.import.updateMany({
      where: { id: importId, extractionCompletedAt: null },
      data: { excelExtractionRequestId: extractionRequestId },
    });
  }

  /** No-op once a callback has claimed the import, or if it merged away. */
  private async failUnprocessedImport(
    importId: string,
    error: string,
  ): Promise<void> {
    await prisma.import.updateMany({
      where: { id: importId, extractionCompletedAt: null },
      data: { status: ImportStatus.FAILED, error },
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

    // Categorization may call the AI service, so it runs before the batch:
    // network work has no place inside a database transaction.
    const transactionModel = await transactionService.prepareCreateTransaction({
      description: transactionData.description,
      value: transactionData.value,
      date: transactionData.date,
      type: transactionData.type,
      userId: importedTransaction.userId,
      status: TransactionStatus.APPROVED,
      categoryId: transactionData.categoryId,
    });

    // One batch, so a failure cannot create the transaction while the imported
    // row stays PENDING — retrying that state would create it a second time.
    const [createdTransaction] = await prisma
      .$transaction([
        transactionRepository.createTransactionOp(transactionModel),
        importedTransactionRepository.markApprovedOp(
          importedTransactionId,
          userId,
        ),
      ])
      .catch(throwImportedTransactionNotFoundOnMissingRow);

    await transactionService.notifyTransactionCreatedSafe(
      createdTransaction.id,
      userId,
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
      logger.warn(
        {
          userId,
          importedTransactionId: importedTransaction.id,
          matchingTransactionId: importedTransaction.matchingTransactionId,
        },
        'Stored matching transaction is missing or not owned by the user',
      );
      throw new HttpError(404, 'Matching transaction not found');
    }

    if (transactionData.categoryId) {
      await transactionService.learnCategoryMappingSafe(
        matchingTransaction,
        transactionData.categoryId,
        userId,
      );
    }

    const approveMatch =
      matchingTransaction.status === TransactionStatus.PENDING_APPROVAL;

    // One batch, so the matched transaction cannot end up updated while the
    // imported row stays PENDING and re-mergeable.
    await prisma
      .$transaction([
        transactionRepository.updateTransactionOp(
          importedTransaction.matchingTransactionId,
          {
            description: transactionData.description,
            type: transactionData.type,
            value: transactionData.value,
            date: transactionData.date,
            categoryId: transactionData.categoryId,
            ...(approveMatch ? { status: TransactionStatus.APPROVED } : {}),
          },
          userId,
        ),
        importedTransactionRepository.updateStatusOp(
          importedTransactionId,
          userId,
          ImportedTransactionStatus.MERGED,
        ),
      ])
      .catch(throwTransactionNotFoundOnMissingRow);

    if (approveMatch) {
      await transactionService.notifyTransactionCreatedSafe(
        importedTransaction.matchingTransactionId,
        userId,
      );
    }
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

  /**
   * What approving the selection would do, without writing anything.
   * batchApproveImportedTransactions commits this same plan, so the preview
   * cannot promise an outcome the commit would not produce.
   */
  public async buildReconciliationPlan(
    importId: string,
    userId: string,
    transactionIds: string[] | 'all' = 'all',
  ): Promise<ReconciliationPlanItem[]> {
    const pendingTransactions = await this.loadPendingSelection(
      importId,
      userId,
      transactionIds,
    );

    return pendingTransactions.map((transaction) =>
      this.toReconciliationPlanItem(transaction),
    );
  }

  public async batchApproveImportedTransactions(
    importId: string,
    userId: string,
    transactionIds: string[] | 'all',
  ): Promise<BatchResult> {
    const plan = await this.buildReconciliationPlan(
      importId,
      userId,
      transactionIds,
    );

    return this.runReconciliationPlan(plan, userId);
  }

  public async batchIgnoreImportedTransactions(
    importId: string,
    userId: string,
    transactionIds: string[] | 'all',
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

    const plan: ReconciliationPlanItem[] = [];
    for (const transaction of pendingTransactions) {
      const matchingRule = rules.find((rule) =>
        transaction.description
          .toLowerCase()
          .includes(rule.descriptionPattern.toLowerCase()),
      );

      if (!matchingRule) {
        continue;
      }

      plan.push(
        this.toReconciliationPlanItem(transaction, matchingRule.categoryId),
      );
    }

    return this.runReconciliationPlan(plan, userId);
  }

  // Both queries constrain import, owner and status in SQL, so no caller can
  // widen the selection past the user's own pending rows in this import.
  private async loadPendingSelection(
    importId: string,
    userId: string,
    transactionIds: string[] | 'all',
  ): Promise<ImportedTransactionRecord[]> {
    if (transactionIds === 'all') {
      return importedTransactionRepository.findPendingByImportId(
        importId,
        userId,
      );
    }

    return importedTransactionRepository.findPendingByIds(
      importId,
      transactionIds,
      userId,
    );
  }

  private toReconciliationPlanItem(
    transaction: ImportedTransactionRecord,
    categoryOverride?: string,
  ): ReconciliationPlanItem {
    const match = transaction.matchingTransaction;

    return {
      importedTransactionId: transaction.id,
      action: match ? 'MERGE' : 'CREATE',
      description: transaction.description,
      value: transaction.value,
      date: transaction.date,
      type: transaction.type,
      // Never fall back to the transaction id — it is not a category id.
      categoryId: categoryOverride ?? match?.categoryId ?? null,
      match: match
        ? {
            transactionId: match.id,
            approvesPendingTransaction:
              match.status === TransactionStatus.PENDING_APPROVAL,
            before: {
              description: match.description,
              value: match.value,
              date: match.date,
            },
          }
        : null,
    };
  }

  private async runReconciliationPlan(
    plan: ReconciliationPlanItem[],
    userId: string,
  ): Promise<BatchResult> {
    const result: BatchResult = {
      total: plan.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (const item of plan) {
      try {
        await this.applyReconciliationPlanItem(item, userId);
        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: item.importedTransactionId,
          error: getErrorMessage(error),
        });
      }
    }

    return result;
  }

  private async applyReconciliationPlanItem(
    item: ReconciliationPlanItem,
    userId: string,
  ): Promise<void> {
    const payload = {
      description: item.description,
      value: item.value,
      date: item.date,
      type: item.type,
    };

    switch (item.action) {
      case 'MERGE':
        await this.mergeImportedTransaction(
          item.importedTransactionId,
          userId,
          {
            ...payload,
            categoryId: item.categoryId ?? undefined,
          },
        );
        return;
      case 'CREATE':
        await this.approveImportedTransaction(
          item.importedTransactionId,
          userId,
          { ...payload, categoryId: item.categoryId },
        );
        return;
      default:
        throw new Error(`Unknown reconciliation action: ${item.action}`);
    }
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
      type: TransactionType;
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
    transaction: {
      id: string;
      description: string;
      date: Date;
      value: number;
      type: TransactionType;
    },
    userId: string,
    excludedIds?: Set<string>,
  ): Promise<string | null> {
    const matches = await transactionRepository.findPotentialMatches(
      userId,
      transaction.date,
      transaction.value,
      transaction.type,
    );

    const availableMatches = excludedIds
      ? matches.filter((m) => !excludedIds.has(m.id))
      : matches;

    if (availableMatches.length === 0) {
      return null;
    }

    // One unambiguous spelling match needs no model call, which is what keeps a
    // multi-month backfill affordable. A tie falls through to the model, whose
    // job is exactly that judgement.
    const exactMatchId = findExactNormalizedMatch(
      transaction.description,
      availableMatches,
    );
    if (exactMatchId) {
      await this.claimMatch(transaction.id, exactMatchId);
      return exactMatchId;
    }

    // Providers validate their answer already; re-applying the idempotent
    // resolver here makes "never an invented id" structural rather than a
    // contract a future provider could forget.
    const matchingTransactionId = resolveMatchedTransactionId(
      await this.getAiProvider().findMatchingTransaction(
        transaction.description,
        availableMatches,
      ),
      availableMatches,
    );

    if (matchingTransactionId) {
      await this.claimMatch(transaction.id, matchingTransactionId);
    }

    return matchingTransactionId;
  }

  private async claimMatch(
    importedTransactionId: string,
    matchingTransactionId: string,
  ): Promise<void> {
    await prisma.importedTransaction.update({
      where: { id: importedTransactionId },
      data: { matchingTransactionId },
    });
  }
}

export const importService = new ImportService();
