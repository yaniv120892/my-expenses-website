import AIServiceFactory from '@/server/services/ai/aiServiceFactory';
import transactionRepository from '@/server/repositories/transactionRepository';
import transactionFileRepository from '@/server/repositories/transactionFileRepository';
import {
  CreateTransaction,
  CreateTransactionResult,
  Transaction,
  TransactionListFilters,
  TransactionListPage,
  TransactionSummaryFilters,
  TransactionSummary,
  TransactionStatus,
  TransactionFile,
} from '@/shared/types/transaction';
import { CreateTransactionRequest } from '@/shared/schemas/transactions';
import { CreateTransactionDbModel } from '@/server/repositories/types';
import categoryRepository from '@/server/repositories/categoryRepository';
import logger from '@/server/logging/logger';
import { Category } from '@/shared/types/category';
import TransactionNotifierFactory from '@/server/services/transactionNotification/transactionNotifierFactory';
import userSettingsService from '@/server/services/userSettingsService';
import userCategoryMappingRepository from '@/server/repositories/userCategoryMappingRepository';
import {
  buildPreviewUrl,
  buildDownloadUrl,
  getPresignedUploadUrl,
  isAttachmentKeyForTransaction,
} from '@/server/services/transactionAttachmentFileUtils';
import { expandCategoryToSubtree } from '@/server/utils/categoryHierarchy';
import { CustomValidationError } from '@/server/errors/validationError';
import { HttpError } from '@/server/http/errors';
import { lazy } from '@/server/lib/lazy';
import { reportSwallowedError } from '@/server/logging/reportSwallowedError';

// Larger than any UI page: nothing is rendered from this walk, so the only
// cost that matters is the number of round trips.
const ALL_TRANSACTIONS_PAGE_SIZE = 1000;

export interface TransactionFileView {
  id: string;
  fileName: string;
  previewFileUrl: string;
  downloadableFileUrl: string;
  fileSize: number;
  mimeType: string;
}

class TransactionService {
  private getCategorySuggester = lazy(() =>
    AIServiceFactory.getCategorySuggester(),
  );
  private getTransactionNotifier = lazy(() =>
    TransactionNotifierFactory.getNotifier(),
  );

  public async createTransaction(
    data: CreateTransaction,
  ): Promise<CreateTransactionResult> {
    const userProvidedCategory = !!data.categoryId;
    const transactionModel = await this.prepareCreateTransaction(data);
    const transactionId =
      await transactionRepository.createTransaction(transactionModel);

    await this.notifyTransactionCreatedSafe(
      transactionId,
      transactionModel.userId,
    );

    const result: CreateTransactionResult = { id: transactionId };

    if (!userProvidedCategory) {
      const categories = await categoryRepository.getAllCategories();
      const cat = categories.find((c) => c.id === transactionModel.categoryId);
      if (cat) {
        result.suggestedCategory = { id: cat.id, name: cat.name };
      }
    }

    return result;
  }

  /**
   * Stops short of the write, so the AI work runs first and the insert can be
   * batched via createTransactionOp.
   */
  public async prepareCreateTransaction(
    data: CreateTransaction,
  ): Promise<CreateTransactionDbModel> {
    const resolved = await this.updateCategory(data);
    await this.validateCreateTransaction(resolved);
    if (!resolved.categoryId) {
      throw new CustomValidationError(
        'Could not determine a category for this transaction; please choose one',
      );
    }
    return {
      description: resolved.description,
      value: resolved.value,
      date: resolved.date || new Date(),
      categoryId: resolved.categoryId,
      type: resolved.type,
      status: resolved.status || 'APPROVED',
      userId: resolved.userId,
    };
  }

  /**
   * Filtering by a parent category covers the transactions filed on its
   * children.
   */
  private async resolveCategoryFilter<T extends TransactionSummaryFilters>(
    filters: T,
  ): Promise<T> {
    if (!filters.categoryId) {
      return filters;
    }
    return {
      ...filters,
      categoryIds: await expandCategoryToSubtree(filters.categoryId),
    };
  }

  private listResolved(
    filters: TransactionListFilters,
  ): Promise<TransactionListPage> {
    return transactionRepository.getTransactionsList({
      ...filters,
      status: filters.status || 'APPROVED',
    });
  }

  public async getTransactionsList(
    filters: TransactionListFilters,
  ): Promise<TransactionListPage> {
    return this.listResolved(await this.resolveCategoryFilter(filters));
  }

  /**
   * Walked by cursor; `maxRows` stops one page past the cap so an oversized set
   * is refused early.
   */
  public async getAllTransactions(
    filters: TransactionSummaryFilters,
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
    const transactionId = await transactionRepository.updateTransactionStatus(
      id,
      status,
      userId,
    );
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

  public async updateTransaction(
    id: string,
    data: CreateTransactionRequest,
    userId: string,
  ): Promise<void> {
    if (data.categoryId) {
      try {
        const existing = await transactionRepository.getTransactionItem(
          id,
          userId,
        );
        if (existing) {
          await this.learnCategoryMappingSafe(
            {
              description: existing.description,
              categoryId: existing.category.id,
            },
            data.categoryId,
            userId,
          );
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to save category mapping on update');
      }
    }
    await transactionRepository.updateTransaction(id, data, userId);
  }

  public async learnCategoryMappingSafe(
    charge: { description: string; categoryId: string },
    categoryId: string,
    userId: string,
  ): Promise<void> {
    if (charge.categoryId === categoryId) {
      return;
    }
    try {
      const normalizedDescription = charge.description.toLowerCase().trim();
      await userCategoryMappingRepository.upsert(
        userId,
        normalizedDescription,
        categoryId,
      );
      logger.debug(
        `Saved category mapping: "${normalizedDescription}" -> ${categoryId}`,
      );
    } catch (err) {
      logger.warn({ err }, 'Failed to save category mapping on update');
    }
  }

  public async deleteTransaction(id: string, userId: string): Promise<void> {
    return transactionRepository.deleteTransaction(id, userId);
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
    if (!isAttachmentKeyForTransaction(fileData.fileKey, transactionId)) {
      throw new HttpError(
        400,
        `fileKey was not issued for transaction ${transactionId}`,
      );
    }

    await this.assertTransactionExists(transactionId, userId);

    await transactionFileRepository.create({
      transactionId,
      ...fileData,
    });

    logger.debug({ transactionId, fileData }, 'File attached to transaction');
  }

  public async getTransactionFiles(
    transactionId: string,
    userId: string,
  ): Promise<TransactionFileView[]> {
    await this.assertTransactionExists(transactionId, userId);

    const files =
      await transactionFileRepository.findByTransactionId(transactionId);

    return Promise.all(
      files.map(async (file) => {
        const previewFileUrl = await buildPreviewUrl(file.fileKey);
        const downloadableFileUrl = await buildDownloadUrl(
          file.fileKey,
          file.fileName,
        );
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
    transactionId: string,
    fileId: string,
    userId: string,
  ): Promise<void> {
    await this.assertTransactionExists(transactionId, userId);
    await this.assertTransactionFileExists(fileId, transactionId);

    await transactionFileRepository.markForDeletion(fileId);
    logger.debug(
      `File ${fileId} marked for deletion from transaction ${transactionId}`,
    );
  }

  public async getPresignedUploadUrl(
    transactionId: string,
    userId: string,
    fileName: string,
    mimeType: string,
  ) {
    await this.assertTransactionExists(transactionId, userId);
    return getPresignedUploadUrl(transactionId, fileName, mimeType);
  }

  private async validateCreateTransaction(
    data: CreateTransaction,
  ): Promise<void> {
    const category = await categoryRepository.getCategoryById(data.categoryId);
    if (!category) {
      throw new CustomValidationError(
        `Category with id ${data.categoryId} not found`,
      );
    }
  }

  private async updateCategory(
    transaction: CreateTransaction,
  ): Promise<CreateTransaction> {
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
      const mapping =
        await userCategoryMappingRepository.findByUserAndDescription(
          userId,
          description.toLowerCase().trim(),
        );
      const mappedCategory = mapping
        ? categories.find((c) => c.id === mapping.categoryId)
        : undefined;
      if (mappedCategory) {
        logger.debug(
          `User mapping found for expense: ${description} -> ${mappedCategory.name}`,
        );
        return mappedCategory.id;
      }
    } catch (err) {
      reportSwallowedError(
        { err, userId },
        'Failed to check user category mapping',
      );
    }
    return null;
  }

  public async notifyTransactionCreatedSafe(
    transactionId: string,
    userId: string,
  ) {
    await this.notifyTransactionsCreatedSafe([transactionId], userId);
  }

  /**
   * Notifies each transaction on its own, so one failure cannot silence the
   * rest.
   */
  public async notifyTransactionsCreatedSafe(
    transactionIds: string[],
    userId: string,
  ) {
    if (transactionIds.length === 0) {
      return;
    }

    let isNotificationEnabled: boolean;
    try {
      isNotificationEnabled =
        await userSettingsService.isCreateTransactionNotificationEnabled(
          userId,
        );
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

  private async notifyOneTransactionCreatedSafe(
    transactionId: string,
    userId: string,
  ) {
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

      await this.getTransactionNotifier().notifyTransactionCreated(
        transaction,
        userId,
      );
    } catch (error) {
      logger.error(
        { err: error, transactionId },
        'Failed to notify transaction created',
      );
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
}

export default new TransactionService();
