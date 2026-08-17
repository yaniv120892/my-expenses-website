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
    const createTransaction = await this.updateCategory(data);
    await this.validateCreateTransaction(createTransaction);
    const CreateTransactionDbModel = {
      description: createTransaction.description,
      value: createTransaction.value,
      date: createTransaction.date || new Date(),
      categoryId: createTransaction.categoryId as string,
      type: createTransaction.type,
      status: createTransaction.status || 'APPROVED',
      userId: createTransaction.userId,
    };
    const transactionId = await transactionRepository.createTransaction(
      CreateTransactionDbModel,
    );

    await this.notifyTransactionCreatedSafe(
      transactionId,
      createTransaction.userId,
    );

    const result: CreateTransactionResult = { id: transactionId };

    if (!userProvidedCategory && createTransaction.categoryId) {
      const categories = await categoryRepository.getAllCategories();
      const cat = categories.find((c) => c.id === createTransaction.categoryId);
      if (cat) {
        result.suggestedCategory = { id: cat.id, name: cat.name };
      }
    }

    return result;
  }

  /**
   * Widens a category filter to the whole subtree, so filtering by a parent
   * covers the transactions filed on its children. Already-resolved filters
   * pass through untouched, which keeps the walk in getAllTransactions from
   * rebuilding the map once per page.
   */
  private async resolveCategoryFilter<T extends TransactionSummaryFilters>(
    filters: T,
  ): Promise<T> {
    if (!filters.categoryId || filters.categoryIds) {
      return filters;
    }
    return {
      ...filters,
      categoryIds: await expandCategoryToSubtree(filters.categoryId),
    };
  }

  public async getTransactionsList(
    filters: TransactionListFilters,
  ): Promise<TransactionListPage> {
    const resolved = await this.resolveCategoryFilter(filters);
    return transactionRepository.getTransactionsList({
      ...resolved,
      status: resolved.status || 'APPROVED',
    });
  }

  /**
   * Every matching row, for the callers that need the whole set (export,
   * backup, monthly report). Walks by cursor rather than by offset: this walk
   * reaches the last page by definition, and offset paging makes each page
   * re-scan every row before it.
   */
  public async getAllTransactions(
    filters: TransactionSummaryFilters,
  ): Promise<Transaction[]> {
    const transactions: Transaction[] = [];
    const resolved = await this.resolveCategoryFilter(filters);
    let cursor: string | undefined;

    do {
      const page = await this.getTransactionsList({
        ...resolved,
        cursor,
        limit: ALL_TRANSACTIONS_PAGE_SIZE,
      });
      transactions.push(...page.items);
      cursor = page.nextCursor ?? undefined;
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
        if (existing && existing.category.id !== data.categoryId) {
          const normalizedDescription = existing.description
            .toLowerCase()
            .trim();
          await userCategoryMappingRepository.upsert(
            userId,
            normalizedDescription,
            data.categoryId,
          );
          logger.debug(
            `Saved category mapping: "${normalizedDescription}" -> ${data.categoryId}`,
          );
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to save category mapping on update');
      }
    }
    await transactionRepository.updateTransaction(id, data, userId);
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
      logger.warn(`Failed to categorize expense: ${description}`);
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
    logger.debug(`Done categorizing expense: ${description}`);

    if (!response.data.category) {
      logger.error('No category found for expense using categorizer.');
      return null;
    }

    return {
      category: response.data.category,
      confidence: response.data.confidence ?? 0,
    };
  }

  private async notifyTransactionCreatedSafe(
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
