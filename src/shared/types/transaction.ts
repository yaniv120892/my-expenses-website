export type TransactionStatus = 'APPROVED' | 'PENDING_APPROVAL';

export type TransactionFileStatus =
  | 'ACTIVE'
  | 'MARKED_FOR_DELETION'
  | 'DELETED';

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
  transactionType?: TransactionType;
  searchTerm?: string;
  status?: TransactionStatus;
  userId: string;
  smartSearch?: boolean;
}

export interface TransactionFilters extends TransactionSummaryFilters {
  page: number;
  perPage: number;
  smartSearch?: boolean;
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
}

export interface CreateTransactionResult {
  id: string;
  suggestedCategory?: {
    id: string;
    name: string;
  };
}

export type TransactionType = 'INCOME' | 'EXPENSE';
