import aiServiceFactory from '@/server/services/ai/aiServiceFactory';
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

// Larger than any UI page: nothing is rendered from this walk, so the only
// cost that matters is the number of round trips.
const ALL_TRANSACTIONS_PAGE_SIZE = 1000;

type CategoryMappingChange = {
  userId: string;
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

  public async createTransaction(data: CreateTransaction): Promise<CreatedTransaction> {
    const userProvidedCategory = !!data.categoryId;
    const transactionModel = await this.prepareCreateTransaction(data);
    const transaction = await transactionRepository.createTransaction(transactionModel);

    await this.notifyTransactionCreatedSafe(transaction.id, transactionModel.userId);

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
    data: CreateTransaction,
  ): Promise<CreateTransactionDbModel> {
    // An undated create is stamped as the form would stamp it: the app's
    // wall-clock time in the UTC fields, not the server's instant.
    const date = data.date || toAppWallClock(new Date());
    const [amount, resolved] = await Promise.all([
      data.resolvedAmount ?? currencyConversionService.resolveAmount(data, date),
      this.updateCategory(data),
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
      userId: resolved.userId,
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

  private listResolved(filters: TransactionListFilters): Promise<TransactionListPage> {
    return transactionRepository.getTransactionsList({
      ...filters,
      status: filters.status || 'APPROVED',
    });
  }

  public async getTransactionsList(filters: TransactionListFilters): Promise<TransactionListPage> {
    return this.listResolved(await this.resolveCategoryFilter(filters));
  }

  /**
   * Walked by cursor; `maxRows` stops one page past the cap so an oversized set
   * is refused early.
   */
  public async getAllTransactions(
    filters: TransactionSummaryFilters & Partial<TransactionSort>,
    { maxRows }: { maxRows?: number } = {},
  ): Promise<Transaction[]> {
    const transactions: Transaction[] = [];
    const resolved = await this.resolveCategoryFilter(filters);
    let cursor: string | undefined;

    do {
      const page = await this.listResolved({
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

  public async getPendingTransactions(userId: string): Promise<Transaction[]> {
    return transactionRepository.getPendingTransactions(userId);
  }

  public async updateTransactionStatus(
    id: string,
    status: TransactionStatus,
    userId: string,
  ): Promise<string> {
    const transactionId = await transactionRepository.updateTransactionStatus(id, status, userId);
    if (status === 'APPROVED') {
      await this.notifyTransactionCreatedSafe(transactionId, userId);
    }

    return transactionId;
  }

  public async getTransactionItem(
    transactionId: string,
    userId: string,
  ): Promise<Transaction | null> {
    return transactionRepository.getTransactionItem(transactionId, userId);
  }

  public async getTransactionsSummary(
    filters: TransactionSummaryFilters,
  ): Promise<TransactionSummary> {
    const resolved = await this.resolveCategoryFilter(filters);
    return transactionRepository.getTransactionsSummary({
      ...resolved,
      status: resolved.status || 'APPROVED',
    });
  }

  public async getCategoryBreakdown(
    filters: TransactionSummaryFilters,
  ): Promise<CategoryBreakdownItem[]> {
    const resolved = await this.resolveCategoryFilter(filters);
    const [totals, categories] = await Promise.all([
      transactionRepository.getCategoryTotals({
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
    id: string,
    data: UpdateTransactionRequest,
    userId: string,
  ): Promise<Transaction> {
    const existing = await transactionRepository.getTransactionItem(id, userId);
    if (!existing) {
      throw new HttpError(404, 'Transaction not found');
    }
    const amount = await currencyConversionService.resolveAmount(data, data.date, existing);
    const updated = await transactionRepository.updateTransaction(
      id,
      {
        description: data.description,
        amount,
        categoryId: data.categoryId,
        type: data.type,
        date: data.date,
      },
      userId,
    );
    await this.learnCategoryMappingSafe({
      userId,
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
      await userCategoryMappingRepository.upsert(
        change.userId,
        descriptionPattern,
        change.categoryId,
      );
      logger.debug(`Saved category mapping: "${descriptionPattern}" -> ${change.categoryId}`);
    } catch (err) {
      logger.warn({ err }, 'Failed to save category mapping on update');
    }
  }

  public async deleteTransaction(id: string, userId: string): Promise<void> {
    const fileKeys = await transactionRepository.deleteTransaction(id, userId);
    await Promise.all(
      fileKeys.map((fileKey) => this.deleteAttachmentObjectSafe({ fileKey, transactionId: id })),
    );
  }

  public async attachFile(
    transactionId: string,
    userId: string,
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

    await this.assertTransactionExists(transactionId, userId);

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
    transactionId: string,
    userId: string,
  ): Promise<TransactionFileView[]> {
    await this.assertTransactionExists(transactionId, userId);

    const files = await transactionFileRepository.findByTransactionId(transactionId);

    return Promise.all(
      files.map(async (file) => {
        const previewFileUrl = await buildPreviewUrl(file.fileKey);
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

  public async removeFile(transactionId: string, fileId: string, userId: string): Promise<void> {
    await this.assertTransactionExists(transactionId, userId);
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
    transactionId: string,
    userId: string,
    file: { fileName: string; mimeType: string; fileSize: number },
  ) {
    assertWithinUploadLimit({
      fileName: file.fileName,
      sizeInBytes: file.fileSize,
    });
    await this.assertTransactionExists(transactionId, userId);
    return getPresignedUploadUrl({ transactionId, ...file });
  }

  private async validateCreateTransaction(data: CreateTransaction): Promise<void> {
    const category = await categoryRepository.getCategoryById(data.categoryId);
    if (!category) {
      throw new CustomValidationError(`Category with id ${data.categoryId} not found`);
    }
  }

  private async updateCategory(transaction: CreateTransaction): Promise<CreateTransaction> {
    if (transaction.categoryId) {
      return transaction;
    }

    const categories = await categoryRepository.getAllCategories();

    const suggestedCategoryId = await this.getSuggestedCategory(
      transaction.description,
      transaction.userId,
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
    description: string,
    userId: string,
    categories: Category[],
  ): Promise<string | null> {
    return (
      (await this.findUserMappedCategoryId(description, userId, categories)) ??
      this.getCategorySuggester().suggestCategory(description, categories)
    );
  }

  private async findUserMappedCategoryId(
    description: string,
    userId: string,
    categories: Category[],
  ): Promise<string | null> {
    try {
      const mapping = await userCategoryMappingRepository.findByUserAndDescription(
        userId,
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
        where: 'Failed to check user category mapping',
        context: { userId },
      });
    }
    return null;
  }

  public async notifyTransactionCreatedSafe(transactionId: string, userId: string) {
    await this.notifyTransactionsCreatedSafe([transactionId], userId);
  }

  /**
   * Notifies each transaction on its own, so one failure cannot silence the
   * rest.
   */
  public async notifyTransactionsCreatedSafe(transactionIds: string[], userId: string) {
    if (transactionIds.length === 0) {
      return;
    }

    let isNotificationEnabled: boolean;
    try {
      isNotificationEnabled =
        await userSettingsService.isCreateTransactionNotificationEnabled(userId);
    } catch (error) {
      logger.error(
        { err: error, userId },
        'Failed to read the create-transaction notification preference',
      );
      return;
    }

    if (!isNotificationEnabled) {
      logger.debug(
        `skipped ${transactionIds.length} notification(s) - not enabled for user ${userId}`,
      );
      return;
    }

    for (const transactionId of transactionIds) {
      await this.notifyOneTransactionCreatedSafe(transactionId, userId);
    }
  }

  private async notifyOneTransactionCreatedSafe(transactionId: string, userId: string) {
    try {
      const transaction = await this.getTransactionItem(transactionId, userId);
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

      await this.getTransactionNotifier().notifyTransactionCreated(transaction, userId);
    } catch (error) {
      logger.error({ err: error, transactionId }, 'Failed to notify transaction created');
    }
  }

  private async assertTransactionExists(
    transactionId: string,
    userId: string,
  ): Promise<Transaction> {
    const transaction = await this.getTransactionItem(transactionId, userId);
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
