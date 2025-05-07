export type TransactionType = "INCOME" | "EXPENSE";

export interface Category {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  description: string;
  value: number;
  date: string; // ISO string
  type: TransactionType;
  category: Category;
}

export interface CreateTransactionInput {
  description: string;
  value: number;
  categoryId: string;
  type: TransactionType;
  date: string;
}

export type UpdateTransactionInput = CreateTransactionInput;

export interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  byCategory?: { [category: string]: number };
  byMonth?: { [month: string]: number };
}

export interface TransactionFilters {
  searchTerm?: string;
  categoryId?: string;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  page?: number;
  perPage?: number;
}
