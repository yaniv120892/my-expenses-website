import aiServiceFactory from '@/server/services/ai/aiServiceFactory';
import householdActivityService from '@/server/services/householdActivityService';
import type { ActivityEntry } from '@/server/services/householdActivityService';
import transactionRepository from '@/server/repositories/transactionRepository';
import transactionFileRepository from '@/server/repositories/transactionFileRepository';
import type {
  CreateTransaction,
  CategoryBreakdownItem,
  CreatedTransaction,
  Transaction,
  TransactionListFilters,
  TransactionListPage,
  TransactionSummaryFilters,
  TransactionSummary,
  TransactionStatus,
  TransactionFile,
} from '@/shared/types/transaction';
import type { TransactionSort, UpdateTransactionRequest } from '@/shared/schemas/transactions';
import currencyConversionService from '@/server/services/currencyConversionService';
import type { CreateTransactionDbModel } from '@/server/repositories/types';
import categoryRepository from '@/server/repositories/categoryRepository';
import { logger, observability } from '@/server/observability';
import type { Category } from '@/shared/types/category';
import transactionNotifierFactory from '@/server/services/transactionNotification/transactionNotifierFactory';
import userSettingsService from '@/server/services/userSettingsService';
import userCategoryMappingRepository from '@/server/repositories/userCategoryMappingRepository';
import {
  buildPreviewUrl,
  buildDownloadUrl,
  deleteAttachmentObject,
  getPresignedUploadUrl,
  isAttachmentKeyForTransaction,
} from '@/server/services/transactionAttachmentFileUtils';
import { expandCategoryToSubtree, rollUpToNamedTopLevel } from '@/server/utils/categoryHierarchy';
import { CustomValidationError } from '@/server/errors/validationError';
import { HttpError } from '@/server/http/errors';
import { assertWithinUploadLimit } from '@/server/utils/uploadLimit';
import { lazy } from '@/server/lib/lazy';
import { toAppWallClock } from '@/shared/dates';
import { actingUserId } from '@/server/auth/householdActor';
import type { HouseholdActor, HouseholdId } from '@/server/auth/householdActor.types';

// Larger than any UI page: nothing is rendered from this walk, so the only
// cost that matters is the number of round trips.
const ALL_TRANSACTIONS_PAGE_SIZE = 1000;

type CategoryMappingChange = {
  actor: HouseholdActor;
  description: string;
  previousCategoryId: string;
  categoryId: string;
};

export type TransactionFileView = {
  id: string;
  fileName: string;
  previewFileUrl: string;
  downloadableFileUrl: string;
  fileSize: number;
  mimeType: string;
};

class TransactionService {
  private getCategorySuggester = lazy(() => aiServiceFactory.getCategorySuggester());
  private getTransactionNotifier = lazy(() => transactionNotifierFactory.getNotifier());

  public async createTransaction(
    actor: HouseholdActor,
    data: CreateTransaction,
  ): Promise<CreatedTransaction> {
    const userProvidedCategory = !!data.categoryId;
    const transactionModel = await this.prepareCreateTransaction(actor, data);
    const transaction = await householdActivityService.record({
      actor,
      write: () => transactionRepository.createTransaction(transactionModel),
      describe: (created) => transactionActivity({ action: 'CREATE', transaction: created }),
    });

    await this.notifyTransactionCreatedSafe(actor.householdId, transaction.id);

    return {
      id: transaction.id,
      ...(!userProvidedCategory && { suggestedCategory: transaction.category }),
      transaction,
    };
  }

  /**
   * Stops short of the write, so the AI work runs first and the insert can be
   * batched via createTransactionOp.
   */
  public async prepareCreateTransaction(
    actor: HouseholdActor,
    data: CreateTransaction,
  ): Promise<CreateTransactionDbModel> {
    // An undated create is stamped as the form would stamp it: the app's
    // wall-clock time in the UTC fields, not the server's instant.
    const date = data.date || toAppWallClock(new Date());
    const [amount, resolved] = await Promise.all([
      data.resolvedAmount ?? currencyConversionService.resolveAmount(data, date),
      this.updateCategory(actor.householdId, data),
    ]);
    await this.validateCreateTransaction(resolved);
    if (!resolved.categoryId) {
      throw new CustomValidationError(
        'Could not determine a category for this transaction; please choose one',
      );
    }
    return {
      description: resolved.description,
      ...amount,
      date,
      categoryId: resolved.categoryId,
      type: resolved.type,
      status: resolved.status || 'APPROVED',
      scheduledTransactionId: resolved.scheduledTransactionId,
      householdId: actor.householdId,
      userId: actingUserId(actor),
    };
  }

  /**
   * Filtering by a parent category covers the transactions filed on its
   * children.
   */
  private async resolveCategoryFilter<T extends TransactionSummaryFilters>(filters: T): Promise<T> {
    if (!filters.categoryId) {
      return filters;
    }
    return {
      ...filters,
      categoryIds: await expandCategoryToSubtree(filters.categoryId),
    };
  }

  private listResolved(
    householdId: HouseholdId,
    filters: TransactionListFilters,
  ): Promise<TransactionListPage> {
    return transactionRepository.getTransactionsList(householdId, {
      ...filters,
      status: filters.status || 'APPROVED',
    });
  }

  public async getTransactionsList(
    householdId: HouseholdId,
    filters: TransactionListFilters,
  ): Promise<TransactionListPage> {
    return this.listResolved(householdId, await this.resolveCategoryFilter(filters));
  }

  /**
   * Walked by cursor; `maxRows` stops one page past the cap so an oversized set
   * is refused early.
   */
  public async getAllTransactions(
    householdId: HouseholdId,
    filters: TransactionSummaryFilters & Partial<TransactionSort>,
    { maxRows }: { maxRows?: number } = {},
  ): Promise<Transaction[]> {
    const transactions: Transaction[] = [];
    const resolved = await this.resolveCategoryFilter(filters);
    let cursor: string | undefined;

    do {
      const page = await this.listResolved(householdId, {
        ...resolved,
        cursor,
        limit: ALL_TRANSACTIONS_PAGE_SIZE,
      });
      transactions.push(...page.items);
      cursor = page.nextCursor ?? undefined;
      if (maxRows !== undefined && transactions.length > maxRows) {
        return transactions;
      }
    } while (cursor);

    return transactions;
  }

  public async getPendingTransactions(householdId: HouseholdId): Promise<Transaction[]> {
    return transactionRepository.getPendingTransactions(householdId);
  }

  public async updateTransactionStatus(
    actor: HouseholdActor,
    id: string,
    status: TransactionStatus,
  ): Promise<string> {
    const transactionId = await householdActivityService.record({
      actor,
      write: () => transactionRepository.updateTransactionStatus(actor.householdId, id, status),
      describe: (updatedId) => ({
        action: status === 'APPROVED' ? 'APPROVE' : 'UPDATE',
        entityType: 'TRANSACTION',
        entityId: updatedId,
        summary: `Status set to ${status}`,
      }),
    });
    if (status === 'APPROVED') {
      await this.notifyTransactionCreatedSafe(actor.householdId, transactionId);
    }

    return transactionId;
  }

  public async getTransactionItem(
    householdId: HouseholdId,
    transactionId: string,
  ): Promise<Transaction | null> {
    return transactionRepository.getTransactionItem(householdId, transactionId);
  }

  public async getTransactionsSummary(
    householdId: HouseholdId,
    filters: TransactionSummaryFilters,
  ): Promise<TransactionSummary> {
    const resolved = await this.resolveCategoryFilter(filters);
    return transactionRepository.getTransactionsSummary(householdId, {
      ...resolved,
      status: resolved.status || 'APPROVED',
    });
  }

  public async getCategoryBreakdown(
    householdId: HouseholdId,
    filters: TransactionSummaryFilters,
  ): Promise<CategoryBreakdownItem[]> {
    const resolved = await this.resolveCategoryFilter(filters);
    const [totals, categories] = await Promise.all([
      transactionRepository.getCategoryTotals(householdId, {
        ...resolved,
        status: resolved.status || 'APPROVED',
      }),
      categoryRepository.getAllCategories(),
    ]);
    const slices = rollUpToNamedTopLevel(totals, categories).filter((slice) => slice.amount > 0);
    const total = slices.reduce((sum, slice) => sum + slice.amount, 0);
    return slices.map((slice) => ({
      ...slice,
      percentage: (slice.amount / total) * 100,
    }));
  }

  public async updateTransaction(
    actor: HouseholdActor,
    id: string,
    data: UpdateTransactionRequest,
  ): Promise<Transaction> {
    const existing = await transactionRepository.getTransactionItem(actor.householdId, id);
    if (!existing) {
      throw new HttpError(404, 'Transaction not found');
    }
    const amount = await currencyConversionService.resolveAmount(data, data.date, existing);
    const updated = await householdActivityService.record({
      actor,
      write: () =>
        transactionRepository.updateTransaction(actor.householdId, id, {
          description: data.description,
          amount,
          categoryId: data.categoryId,
          type: data.type,
          date: data.date,
        }),
      describe: (transaction) => transactionActivity({ action: 'UPDATE', transaction }),
    });
    await this.learnCategoryMappingSafe({
      actor,
      description: data.description,
      previousCategoryId: existing.category.id,
      categoryId: data.categoryId,
    });
    return updated;
  }

  public async learnCategoryMappingSafe(change: CategoryMappingChange): Promise<void> {
    if (change.previousCategoryId === change.categoryId) {
      return;
    }
    const descriptionPattern = this.toDescriptionPattern(change.description);
    if (!descriptionPattern) {
      return;
    }
    try {
      await userCategoryMappingRepository.upsert({
        householdId: change.actor.householdId,
        userId: actingUserId(change.actor),
        descriptionPattern,
        categoryId: change.categoryId,
      });
      logger.debug(`Saved category mapping: "${descriptionPattern}" -> ${change.categoryId}`);
    } catch (err) {
      logger.warn({ err }, 'Failed to save category mapping on update');
    }
  }

  public async deleteTransaction(actor: HouseholdActor, id: string): Promise<void> {
    const { fileKeys } = await householdActivityService.record({
      actor,
      write: async () => ({
        removed: await transactionRepository.getTransactionItem(actor.householdId, id),
        fileKeys: await transactionRepository.deleteTransaction(actor.householdId, id),
      }),
      describe: ({ removed }) =>
        removed && transactionActivity({ action: 'DELETE', transaction: removed }),
    });
    await Promise.all(
      fileKeys.map((fileKey) => this.deleteAttachmentObjectSafe({ fileKey, transactionId: id })),
    );
  }

  public async attachFile(
    actor: HouseholdActor,
    transactionId: string,
    fileData: {
      fileName: string;
      fileKey: string;
      fileSize: number;
      mimeType: string;
    },
  ): Promise<void> {
    assertWithinUploadLimit({
      fileName: fileData.fileName,
      sizeInBytes: fileData.fileSize,
    });
    if (!isAttachmentKeyForTransaction(fileData.fileKey, transactionId)) {
      throw new HttpError(400, `fileKey was not issued for transaction ${transactionId}`);
    }

    await this.assertTransactionExists(actor.householdId, transactionId);

    await transactionFileRepository.create({
      transactionId,
      ...fileData,
    });

    logger.debug(
      {
        transactionId,
        fileKey: fileData.fileKey,
        fileSize: fileData.fileSize,
        mimeType: fileData.mimeType,
      },
      'File attached to transaction',
    );
  }

  public async getTransactionFiles(
    householdId: HouseholdId,
    transactionId: string,
  ): Promise<TransactionFileView[]> {
    await this.assertTransactionExists(householdId, transactionId);

    const files = await transactionFileRepository.findByTransactionId(transactionId);

    return Promise.all(
      files.map(async (file) => {
        const previewFileUrl = await buildPreviewUrl({
          key: file.fileKey,
          fileName: file.fileName,
        });
        const downloadableFileUrl = await buildDownloadUrl(file.fileKey, file.fileName);
        return {
          id: file.id,
          fileName: file.fileName,
          previewFileUrl,
          downloadableFileUrl,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
        };
      }),
    );
  }

  public async removeFile(
    actor: HouseholdActor,
    transactionId: string,
    fileId: string,
  ): Promise<void> {
    await this.assertTransactionExists(actor.householdId, transactionId);
    const file = await this.assertTransactionFileExists(fileId, transactionId);

    await transactionFileRepository.markForDeletion(fileId);
    logger.debug(`File ${fileId} marked for deletion from transaction ${transactionId}`);
    await this.deleteAttachmentObjectSafe({
      fileKey: file.fileKey,
      transactionId,
      fileId,
    });
  }

  public async getPresignedUploadUrl(
    actor: HouseholdActor,
    transactionId: string,
    file: { fileName: string; mimeType: string; fileSize: number },
  ) {
    assertWithinUploadLimit({
      fileName: file.fileName,
      sizeInBytes: file.fileSize,
    });
    await this.assertTransactionExists(actor.householdId, transactionId);
    return getPresignedUploadUrl({ transactionId, ...file });
  }

  private async validateCreateTransaction(data: CreateTransaction): Promise<void> {
    const category = await categoryRepository.getCategoryById(data.categoryId);
    if (!category) {
      throw new CustomValidationError(`Category with id ${data.categoryId} not found`);
    }
  }

  private async updateCategory(
    householdId: HouseholdId,
    transaction: CreateTransaction,
  ): Promise<CreateTransaction> {
    if (transaction.categoryId) {
      return transaction;
    }

    const categories = await categoryRepository.getAllCategories();

    const suggestedCategoryId = await this.getSuggestedCategory(
      householdId,
      transaction.description,
      categories,
    );
    if (!suggestedCategoryId) {
      throw new CustomValidationError(
        'Could not determine a category for this transaction; please choose one',
      );
    }

    return {
      ...transaction,
      categoryId: suggestedCategoryId,
    };
  }

  private async getSuggestedCategory(
    householdId: HouseholdId,
    description: string,
    categories: Category[],
  ): Promise<string | null> {
    return (
      (await this.findMappedCategoryId(householdId, description, categories)) ??
      this.getCategorySuggester().suggestCategory(description, categories)
    );
  }

  private async findMappedCategoryId(
    householdId: HouseholdId,
    description: string,
    categories: Category[],
  ): Promise<string | null> {
    try {
      const mapping = await userCategoryMappingRepository.findByDescription(
        householdId,
        this.toDescriptionPattern(description),
      );
      const mappedCategory = mapping
        ? categories.find((c) => c.id === mapping.categoryId)
        : undefined;
      if (mappedCategory) {
        logger.debug(`User mapping found for expense: ${description} -> ${mappedCategory.name}`);
        return mappedCategory.id;
      }
    } catch (err) {
      observability.reportError({
        error: err,
        where: 'Failed to check the category mapping',
        context: { householdId },
      });
    }
    return null;
  }

  public async notifyTransactionCreatedSafe(householdId: HouseholdId, transactionId: string) {
    await this.notifyTransactionsCreatedSafe(householdId, [transactionId]);
  }

  /**
   * Tells every member who asked to hear of new transactions, whoever added
   * them. Each transaction is notified on its own, so one failure cannot
   * silence the rest.
   */
  public async notifyTransactionsCreatedSafe(householdId: HouseholdId, transactionIds: string[]) {
    if (transactionIds.length === 0) {
      return;
    }

    let recipientIds: string[];
    try {
      recipientIds = await userSettingsService.findMembersNotifiedOfNewTransactions(householdId);
    } catch (error) {
      logger.error(
        { err: error, householdId },
        'Failed to read the create-transaction notification preference',
      );
      return;
    }

    if (recipientIds.length === 0) {
      logger.debug(
        `skipped ${transactionIds.length} notification(s) - not enabled in household ${householdId}`,
      );
      return;
    }

    for (const transactionId of transactionIds) {
      await this.notifyOneTransactionCreatedSafe({ householdId, transactionId, recipientIds });
    }
  }

  private async notifyOneTransactionCreatedSafe({
    householdId,
    transactionId,
    recipientIds,
  }: {
    householdId: HouseholdId;
    transactionId: string;
    recipientIds: string[];
  }) {
    try {
      const transaction = await this.getTransactionItem(householdId, transactionId);
      if (!transaction) {
        logger.warn(
          `skipped notification for transaction ${transactionId} - transaction not found`,
        );
        return;
      }

      if (transaction.status !== 'APPROVED') {
        logger.debug(
          `skipped notification for transaction ${transactionId} - transaction not approved`,
        );
        return;
      }

      // One member's broken channel must not silence the others.
      for (const userId of recipientIds) {
        try {
          await this.getTransactionNotifier().notifyTransactionCreated(transaction, userId);
        } catch (error) {
          logger.error(
            { err: error, transactionId, userId },
            'Failed to notify a member of a created transaction',
          );
        }
      }
    } catch (error) {
      logger.error({ err: error, transactionId }, 'Failed to notify transaction created');
    }
  }

  private async assertTransactionExists(
    householdId: HouseholdId,
    transactionId: string,
  ): Promise<Transaction> {
    const transaction = await this.getTransactionItem(householdId, transactionId);
    if (!transaction) {
      throw new HttpError(404, 'Transaction not found');
    }
    return transaction;
  }

  /**
   * Runs after the database write, so a storage failure leaves an orphaned
   * object, never a failed delete. A key another active row still names is kept.
   */
  private async deleteAttachmentObjectSafe({
    fileKey,
    transactionId,
    fileId,
  }: {
    fileKey: string;
    transactionId: string;
    fileId?: string;
  }): Promise<void> {
    try {
      const isStillAttached = await transactionFileRepository.hasActiveFileWithKey(fileKey);
      if (isStillAttached) {
        return;
      }
      await deleteAttachmentObject(fileKey);
    } catch (err) {
      // An older key ends with the uploaded file's name and the error can quote it,
      // so both go only to the log, where the orphan is found and cleaned up.
      logger.warn({ err, fileKey, transactionId, fileId }, 'Attachment object left in storage');
      observability.reportError({
        error: this.toNameOnlyError(err),
        where: 'Failed to delete attachment object from storage',
        context: { transactionId, fileId },
      });
      return;
    }
    if (!fileId) {
      return;
    }
    try {
      await transactionFileRepository.markDeleted(fileId);
    } catch (err) {
      observability.reportError({
        error: err,
        where: 'Deleted attachment object but failed to mark its file DELETED',
        context: { transactionId, fileId },
      });
    }
  }

  private toNameOnlyError(err: unknown): Error {
    const errorName = err instanceof Error ? err.name : typeof err;
    return new Error(`Attachment object delete failed: ${errorName}`);
  }

  private async assertTransactionFileExists(
    fileId: string,
    transactionId: string,
  ): Promise<TransactionFile> {
    const file = await transactionFileRepository.findById(fileId);
    if (!file || file.transactionId !== transactionId) {
      throw new HttpError(404, 'File not found');
    }
    return file;
  }

  private toDescriptionPattern(description: string): string {
    return description.toLowerCase().trim();
  }
}

const transactionService = new TransactionService();
export default transactionService;

function transactionActivity({
  action,
  transaction,
}: {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  transaction: { id: string; description: string };
}): ActivityEntry {
  return {
    action,
    entityType: 'TRANSACTION',
    entityId: transaction.id,
    summary: transaction.description,
  };
}
