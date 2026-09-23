import {
  Import,
  ImportStatus,
  TransactionType,
  TransactionStatus,
  ImportedTransactionStatus,
} from '@prisma/client';
import logger from '@/server/logging/logger';
import { getErrorMessage } from '@/server/utils/errorUtils';
import {
  importRepository,
  type ImportWithPendingCount,
} from '@/server/repositories/importRepository';
import {
  importedTransactionRepository,
  type ImportedTransactionWithMatch,
} from '@/server/repositories/importedTransactionRepository';
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
import {
  ReconciliationPlanItem,
  ReconciliationPreviewItem,
  NO_PENDING_TRANSACTIONS_TO_REMATCH_ERROR,
} from '@/shared/types/import';
import type { Transaction } from '@/shared/types/transaction';
import { findExactNormalizedMatch } from '@/server/utils/transactionMatching';
import { deriveReviewHint } from '@/server/utils/reconciliationReview';

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

// A requested id a concurrent action already handled, reported as a failure
// rather than silently dropped from the count.
const STALE_TRANSACTION_ID_ERROR =
  'Not found, not pending, or not in this import';

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

// Satisfied by both an imported row and a pending transaction.
type MatchableTransaction = {
  id: string;
  description: string;
  date: Date;
  value: number;
  type: TransactionType;
};

// A plan item beside the row it was derived from. loadPendingSelection has
// already read the row with its matched transaction, so applying the item
// needs no further read.
type PlannedRow = {
  record: ImportedTransactionWithMatch;
  item: ReconciliationPlanItem;
};

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

      // The signed callback may already have completed or merged the import, so
      // only the request id is recorded, and only while the import still waits.
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
    return imports.map((imp) => this.toImportListItem(imp));
  }

  public async getImport(importId: string, userId: string) {
    const importRecord = await importRepository.findByIdForUser(
      importId,
      userId,
    );
    if (!importRecord) {
      throw new HttpError(404, 'Import not found');
    }
    return this.toImportListItem(importRecord);
  }

  private toImportListItem(imp: ImportWithPendingCount) {
    const { _count, mergedInto, ...importData } = imp;
    return {
      ...importData,
      isVerified: _count.transactions === 0,
      mergedIntoFileName: mergedInto?.originalFileName ?? null,
    };
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
    const record = await this.loadOwnedRow(importedTransactionId, userId);
    const notifyTransactionId = await this.applyCreate(record, transactionData);
    await transactionService.notifyTransactionCreatedSafe(
      notifyTransactionId,
      userId,
    );
  }

  public async mergeImportedTransaction(
    importedTransactionId: string,
    userId: string,
    transactionData: MergeImportedTransactionData,
  ) {
    const record = await this.loadOwnedRow(importedTransactionId, userId);
    const notifyTransactionId = await this.applyMerge(record, transactionData);
    if (notifyTransactionId) {
      await transactionService.notifyTransactionCreatedSafe(
        notifyTransactionId,
        userId,
      );
    }
  }

  private async loadOwnedRow(
    importedTransactionId: string,
    userId: string,
  ): Promise<ImportedTransactionWithMatch> {
    const record = await importedTransactionRepository.findById(
      importedTransactionId,
    );

    if (!record || record.userId !== userId) {
      throw new HttpError(404, 'Imported transaction not found');
    }

    return record;
  }

  private async applyCreate(
    record: ImportedTransactionWithMatch,
    transactionData: ApproveImportedTransactionData,
  ): Promise<string> {
    // Categorization may call the AI service, so it runs before the batch:
    // network work has no place inside a database transaction.
    const transactionModel = await transactionService.prepareCreateTransaction({
      description: transactionData.description,
      value: transactionData.value,
      date: transactionData.date,
      type: transactionData.type,
      userId: record.userId,
      status: TransactionStatus.APPROVED,
      categoryId: transactionData.categoryId,
    });

    // One batch, so a failure cannot create the transaction while the imported
    // row stays PENDING — retrying that state would create it a second time.
    const [createdTransaction] = await prisma
      .$transaction([
        transactionRepository.createTransactionOp(transactionModel),
        importedTransactionRepository.markApprovedOp(record.id, record.userId),
      ])
      .catch(throwImportedTransactionNotFoundOnMissingRow);

    return createdTransaction.id;
  }

  /** Returns the transaction to notify about only if the merge approved it. */
  private async applyMerge(
    record: ImportedTransactionWithMatch,
    transactionData: MergeImportedTransactionData,
  ): Promise<string | null> {
    const { matchingTransaction, matchingTransactionId, userId } = record;

    if (!matchingTransactionId) {
      throw new HttpError(409, 'No matching transaction to merge with');
    }

    if (!matchingTransaction || matchingTransaction.userId !== userId) {
      logger.warn(
        {
          userId,
          importedTransactionId: record.id,
          matchingTransactionId,
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
          matchingTransactionId,
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
          record.id,
          userId,
          ImportedTransactionStatus.MERGED,
        ),
      ])
      .catch(throwTransactionNotFoundOnMissingRow);

    return approveMatch ? matchingTransactionId : null;
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
   * What approving the selection would do, without writing anything;
   * batchApproveImportedTransactions commits the same plan.
   */
  public async buildReconciliationPlan(
    importId: string,
    userId: string,
    transactionIds: string[] | 'all' = 'all',
  ): Promise<ReconciliationPreviewItem[]> {
    const { pending } = await this.loadPendingSelection(
      importId,
      userId,
      transactionIds,
    );
    const plan = pending.map((transaction) =>
      this.toReconciliationPlanItem(transaction),
    );
    const candidates = await this.findUnclaimedCandidatesForCreates(
      plan,
      userId,
    );

    return plan.map((item) => ({
      ...item,
      reviewHint: deriveReviewHint(item, candidates),
    }));
  }

  public async batchApproveImportedTransactions(
    importId: string,
    userId: string,
    transactionIds: string[] | 'all',
  ): Promise<BatchResult> {
    const { pending, missingIds } = await this.loadPendingSelection(
      importId,
      userId,
      transactionIds,
    );
    const plan = pending.map((record) => ({
      record,
      item: this.toReconciliationPlanItem(record),
    }));

    return this.runReconciliationPlan(plan, userId, missingIds);
  }

  public async batchIgnoreImportedTransactions(
    importId: string,
    userId: string,
    transactionIds: string[] | 'all',
  ): Promise<BatchResult> {
    const { pending, missingIds } = await this.loadPendingSelection(
      importId,
      userId,
      transactionIds,
    );
    const ids = pending.map((t) => t.id);

    const count = await importedTransactionRepository.updateStatusBatch(
      ids,
      userId,
      ImportedTransactionStatus.IGNORED,
    );

    return {
      total: ids.length + missingIds.length,
      succeeded: count,
      failed: ids.length - count + missingIds.length,
      errors: missingIds.map((id) => ({
        id,
        error: STALE_TRANSACTION_ID_ERROR,
      })),
    };
  }

  public async applyAutoApproveRules(
    importId: string,
    userId: string,
  ): Promise<BatchResult> {
    const [{ pending: pendingTransactions }, rules] = await Promise.all([
      this.loadPendingSelection(importId, userId, 'all'),
      autoApproveRuleRepository.findActiveByUserId(userId),
    ]);

    const plan: PlannedRow[] = [];
    for (const record of pendingTransactions) {
      const matchingRule = rules.find((rule) =>
        record.description
          .toLowerCase()
          .includes(rule.descriptionPattern.toLowerCase()),
      );

      if (!matchingRule) {
        continue;
      }

      plan.push({
        record,
        item: this.toReconciliationPlanItem(record, matchingRule.categoryId),
      });
    }

    return this.runReconciliationPlan(plan, userId);
  }

  // Constrained to the user's own pending rows in SQL; `missingIds` lets a
  // caller report ids the query did not return.
  private async loadPendingSelection(
    importId: string,
    userId: string,
    transactionIds: string[] | 'all',
  ): Promise<{
    pending: ImportedTransactionWithMatch[];
    missingIds: string[];
  }> {
    if (transactionIds === 'all') {
      const pending = await importedTransactionRepository.findPendingByImportId(
        importId,
        userId,
      );
      return { pending, missingIds: [] };
    }

    const pending = await importedTransactionRepository.findPendingByIds(
      importId,
      transactionIds,
      userId,
    );
    const foundIds = new Set(pending.map((transaction) => transaction.id));
    const missingIds = transactionIds.filter((id) => !foundIds.has(id));

    return { pending, missingIds };
  }

  // A transaction another pending row already claims is left out: that row's
  // merge will consume it, so it cannot be this row's missed match.
  private async findUnclaimedCandidatesForCreates(
    plan: ReconciliationPlanItem[],
    userId: string,
  ): Promise<Transaction[]> {
    const creates = plan.filter((item) => item.action === 'CREATE');
    if (creates.length === 0) {
      return [];
    }

    const [candidates, claimedIds] = await Promise.all([
      transactionRepository.findPotentialMatchesForCharges(userId, creates),
      importedTransactionRepository.findClaimedMatchingTransactionIds(userId),
    ]);
    const claimed = new Set(claimedIds);

    return candidates.filter((candidate) => !claimed.has(candidate.id));
  }

  private toReconciliationPlanItem(
    transaction: ImportedTransactionWithMatch,
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
    plannedRows: PlannedRow[],
    userId: string,
    missingIds: string[] = [],
  ): Promise<BatchResult> {
    const result: BatchResult = {
      total: plannedRows.length + missingIds.length,
      succeeded: 0,
      failed: missingIds.length,
      errors: missingIds.map((id) => ({
        id,
        error: STALE_TRANSACTION_ID_ERROR,
      })),
    };

    const notifyTransactionIds: string[] = [];
    for (const entry of plannedRows) {
      try {
        const notifyTransactionId = await this.applyPlannedRow(entry);
        if (notifyTransactionId) {
          notifyTransactionIds.push(notifyTransactionId);
        }
        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: entry.record.id,
          error: getErrorMessage(error),
        });
      }
    }

    await transactionService.notifyTransactionsCreatedSafe(
      notifyTransactionIds,
      userId,
    );

    return result;
  }

  private async applyPlannedRow({
    record,
    item,
  }: PlannedRow): Promise<string | null> {
    const payload = {
      description: item.description,
      value: item.value,
      date: item.date,
      type: item.type,
    };

    switch (item.action) {
      case 'MERGE':
        return this.applyMerge(record, {
          ...payload,
          categoryId: item.categoryId ?? undefined,
        });
      case 'CREATE':
        return this.applyCreate(record, {
          ...payload,
          categoryId: item.categoryId,
        });
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
      throw new HttpError(409, NO_PENDING_TRANSACTIONS_TO_REMATCH_ERROR);
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
   * Keeps transactions claimed by non-pending rows out of the running so two
   * rows cannot land on the same one.
   */
  private async rematchPendingTransactions(
    importId: string,
    userId: string,
    allTransactions: ImportedTransactionWithMatch[],
    pendingTransactions: ImportedTransactionWithMatch[],
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
   * One row at a time against a running exclusion set, so no two rows claim the
   * same transaction; a throwing row is logged and skipped.
   */
  private async matchSequentially(
    transactions: MatchableTransaction[],
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
    transaction: MatchableTransaction,
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

    // An unambiguous spelling match skips the model call; a tie falls through
    // to it.
    const exactMatchId = findExactNormalizedMatch(
      transaction.description,
      availableMatches,
    );
    if (exactMatchId) {
      await this.claimMatch(transaction.id, exactMatchId);
      return exactMatchId;
    }

    // Re-applied so "never an invented id" is structural rather than a contract
    // a future provider could forget.
    const matchingTransactionId = resolveMatchedTransactionId(
      await this.getAiProvider().findMatchingTransaction(
        transaction,
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
