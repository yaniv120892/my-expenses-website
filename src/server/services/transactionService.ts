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
import axios from 'axios';
import logger from '@/server/logging/logger';
import { Category } from '@/shared/types/category';
import TransactionNotifierFactory from '@/server/services/transactionNotification/transactionNotifierFactory';
import userSettingsService from '@/server/services/userSettingsService';
import userCategoryMappingRepository from '@/server/repositories/userCategoryMappingRepository';
import {
  buildPreviewUrl,
  buildDownloadUrl,
  getPresignedUploadUrl,
} from '@/server/services/transactionAttachmentFileUtils';
import { expandCategoryToSubtree } from '@/server/utils/categoryHierarchy';
import { CustomValidationError } from '@/server/errors/validationError';
import { requireEnv } from '@/server/env';
import { HttpError } from '@/server/http/errors';
import { lazy } from '@/server/lib/lazy';

// Larger than any UI page: nothing is rendered from this walk, so the only
// cost that matters is the number of round trips.
const ALL_TRANSACTIONS_PAGE_SIZE = 1000;

/** An attachment as returned to clients, with signed URLs resolved. */
export interface TransactionFileView {
  id: string;
  fileName: string;
  previewFileUrl: string;
  downloadableFileUrl: string;
  fileSize: number;
  mimeType: string;
}

const HIGH_CONFIDENCE_THRESHOLD = 0.7;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.4;

class TransactionService {
  private getAiService = lazy(() => AIServiceFactory.getAIService());
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
   * Categorization and validation without the write, so a caller can run the
   * AI/network work first and batch the insert into a prisma.$transaction
   * (via createTransactionOp) with its own writes.
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
   * Widens a category filter to the whole subtree, so filtering by a parent
   * covers the transactions filed on its children.
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

  /** For callers that have already resolved the filters. */
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
   * Every matching row, for the callers that need the whole set (export,
   * backup, monthly report). Cursor rather than offset paging, which re-scans
   * every prior row per page; `maxRows` stops one page past the cap, so an
   * oversized set is refused without walking the whole history.
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
      await this.learnCategoryMappingSafe(id, data.categoryId, userId);
    }
    await transactionRepository.updateTransaction(id, data, userId);
  }

  /**
   * Remembers a manual recategorization so future imports of the same
   * description categorize themselves. Non-critical: a failure logs a warning
   * and never fails the write it accompanies.
   */
  public async learnCategoryMappingSafe(
    transactionId: string,
    categoryId: string,
    userId: string,
  ): Promise<void> {
    try {
      const existing = await transactionRepository.getTransactionItem(
        transactionId,
        userId,
      );
      if (existing && existing.category.id !== categoryId) {
        const normalizedDescription = existing.description.toLowerCase().trim();
        await userCategoryMappingRepository.upsert(
          userId,
          normalizedDescription,
          categoryId,
        );
        logger.debug(
          `Saved category mapping: "${normalizedDescription}" -> ${categoryId}`,
        );
      }
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
    const mappedCategoryId = await this.findUserMappedCategoryId(
      description,
      userId,
      categories,
    );
    if (mappedCategoryId) {
      return mappedCategoryId;
    }

    const prediction = await this.predictKnownCategory(description, categories);

    if (prediction && prediction.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
      logger.debug(
        `High confidence (${prediction.confidence.toFixed(2)}) category: ${prediction.category.name}`,
      );
      return prediction.category.id;
    }

    if (prediction && prediction.confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
      logger.debug(
        `Medium confidence (${prediction.confidence.toFixed(2)}), passing hint to LLM: ${prediction.category.name}`,
      );
      return this.getAiService().suggestCategory(description, categories, {
        hint: prediction.category.name,
        confidence: prediction.confidence,
      });
    }

    logger.warn(
      `No reliable category from categorizer for: ${description}. Using AI service.`,
    );
    return this.getAiService().suggestCategory(description, categories);
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
      logger.warn({ err }, 'Failed to check user category mapping');
    }
    return null;
  }

  // Null covers both a categorizer that returned nothing and a predicted name
  // that is not one of this user's categories; both mean "no usable hint".
  private async predictKnownCategory(
    description: string,
    categories: Category[],
  ): Promise<{ category: Category; confidence: number } | null> {
    let prediction: { category: string; confidence: number } | null = null;
    try {
      prediction = await this.categorizeExpense(description);
    } catch {
      logger.warn({ description }, 'Failed to categorize expense');
    }
    if (!prediction) {
      return null;
    }

    const { category: predictedName, confidence } = prediction;
    const category = categories.find((c) => c.name === predictedName);
    return category ? { category, confidence } : null;
  }

  private async categorizeExpense(
    description: string,
  ): Promise<{ category: string; confidence: number } | null> {
    const expenseCategorizerBaseUrl = requireEnv(
      'EXPENSE_CATEGORIZER_BASE_URL',
    );
    const response = await axios.post(`${expenseCategorizerBaseUrl}/predict`, {
      description,
    });
    logger.debug({ description }, 'Done categorizing expense');

    if (!response.data.category) {
      logger.error(
        { description },
        'No category found for expense using categorizer',
      );
      return null;
    }

    return {
      category: response.data.category,
      confidence: response.data.confidence ?? 0,
    };
  }

  public async notifyTransactionCreatedSafe(
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

      const isNotificationEnabled =
        await userSettingsService.isCreateTransactionNotificationEnabled(
          userId,
        );
      if (!isNotificationEnabled) {
        logger.debug(
          `skipped notification for transaction ${transactionId} - notification not enabled for user ${userId}`,
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
