export enum TabOption {
  Transactions = "transactions",
  PendingTransactions = "pending-transactions",
  ScheduledTransactions = "scheduled-transactions",
  Summary = "summary",
}

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
  categoryId: string | undefined;
  type: TransactionType;
  date: string;
}

export type UpdateTransactionInput = CreateTransactionInput;

export interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
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

export type ScheduleType = "DAILY" | "WEEKLY" | "MONTHLY";

export interface CreateScheduledTransactionInput {
  description: string;
  value: number;
  type: TransactionType;
  categoryId: string;
  scheduleType: ScheduleType;
  interval?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
}

export interface UpdateScheduledTransactionInput {
  description?: string;
  value?: number;
  type?: TransactionType;
  categoryId?: string;
  scheduleType?: ScheduleType;
  interval?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
}

export interface ScheduledTransaction {
  id: string;
  description: string;
  value: number;
  type: TransactionType;
  categoryId: string;
  scheduleType: ScheduleType;
  interval?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  lastRunDate?: string;
  nextRunDate: string;
}
