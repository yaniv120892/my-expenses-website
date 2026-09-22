export type TransactionStatus = 'APPROVED' | 'PENDING_APPROVAL';

export type TransactionFileStatus =
  'ACTIVE' | 'MARKED_FOR_DELETION' | 'DELETED';

export interface TransactionFile {
  id: string;
  transactionId: string;
  fileName: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  status: TransactionFileStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTransaction {
  description: string;
  value: number;
  categoryId: string | null;
  type: TransactionType;
  date: Date | null;
  status?: TransactionStatus;
  userId: string;
}

export interface TransactionSummaryFilters {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  /** `categoryId` expanded to its subtree by the service layer; callers send `categoryId`. */
  categoryIds?: string[];
  transactionType?: TransactionType;
  searchTerm?: string;
  status?: TransactionStatus;
  userId: string;
}

export interface TransactionFilters extends TransactionSummaryFilters {
  page: number;
  perPage: number;
}

// The cursor is opaque; only the repository that issued it may decode it.
export interface TransactionListFilters extends TransactionSummaryFilters {
  cursor?: string;
  limit: number;
}

export interface TransactionListPage {
  items: Transaction[];
  nextCursor: string | null;
}

export interface TransactionItem {
  id: string;
}

export interface Transaction {
  id: string;
  description: string;
  value: number;
  date: Date;
  type: TransactionType;
  status: TransactionStatus;
  category: {
    id: string;
    name: string;
  };
  files?: TransactionFile[];
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  count: number;
  incomeCount: number;
  expenseCount: number;
}

export interface CreateTransactionResult {
  id: string;
  suggestedCategory?: {
    id: string;
    name: string;
  };
}

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
