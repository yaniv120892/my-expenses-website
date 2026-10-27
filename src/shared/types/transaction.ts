import type { TransactionSort } from '@/shared/schemas/transactions';

export type TransactionStatus = 'APPROVED' | 'PENDING_APPROVAL';

export type TransactionFileStatus = 'ACTIVE' | 'MARKED_FOR_DELETION' | 'DELETED';

export type TransactionFile = {
  id: string;
  transactionId: string;
  fileName: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  status: TransactionFileStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ExchangeRateSource = 'STATEMENT' | 'BANK_OF_ISRAEL' | 'MANUAL';

/**
 * `value` is in the reporting currency (ILS) and is what totals sum;
 * `originalAmount` is what was charged, in `currency`. The rate fields say how
 * one became the other and are null for an ILS amount.
 */
export type TransactionAmount = {
  value: number;
  currency: string;
  originalAmount: number;
  exchangeRate: number | null;
  exchangeRateDate: Date | null;
  exchangeRateSource: ExchangeRateSource | null;
};

export type TransactionAmountInput = {
  value?: number;
  currency?: string;
  originalAmount?: number;
  exchangeRate?: number;
};

export type CreateTransaction = {
  description: string;
  /** Set by a caller that already decided the conversion, such as an import. */
  resolvedAmount?: TransactionAmount;
  categoryId: string | null;
  type: TransactionType;
  date: Date | null;
  status?: TransactionStatus;
  scheduledTransactionId?: string;
  userId: string;
} & TransactionAmountInput;

export type TransactionSummaryFilters = {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  /**
   * `categoryId` expanded to its subtree by the service layer; callers send
   * `categoryId`.
   */
  categoryIds?: string[];
  transactionType?: TransactionType;
  searchTerm?: string;
  status?: TransactionStatus;
  userId: string;
};

export type TransactionFilters = {
  page: number;
  perPage: number;
} & TransactionSummaryFilters;

// The cursor is opaque; only the repository that issued it may decode it.
export type TransactionListFilters = TransactionSummaryFilters &
  Partial<TransactionSort> & {
    cursor?: string;
    limit: number;
  };

export type TransactionListPage = {
  items: Transaction[];
  nextCursor: string | null;
};

export type TransactionItem = {
  id: string;
};

export type Transaction = {
  id: string;
  description: string;
  date: Date;
  type: TransactionType;
  status: TransactionStatus;
  category: {
    id: string;
    name: string;
  };
  files?: TransactionFile[];
} & TransactionAmount;

export type TransactionSummary = {
  totalIncome: number;
  totalExpense: number;
  count: number;
  incomeCount: number;
  expenseCount: number;
};

/** One top-level category's share of the filtered rows' total. */
export type CategoryBreakdownItem = {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
};

export type CreateTransactionResult = {
  id: string;
  suggestedCategory?: {
    id: string;
    name: string;
  };
};

/** The server-side result, carrying the stored row so no caller re-reads it. */
export type CreatedTransaction = CreateTransactionResult & {
  transaction: Transaction;
};

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
