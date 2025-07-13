export enum TabOption {
  Transactions = "TRANSACTIONS",
  PendingTransactions = "PENDING_TRANSACTIONS",
  ScheduledTransactions = "SCHEDULED_TRANSACTIONS",
  Summary = "SUMMARY",
  Settings = "SETTINGS",
  Trends = "TRENDS",
  Imports = "IMPORTS",
}

export type TransactionType = "INCOME" | "EXPENSE";

export interface Category {
  id: string;
  name: string;
}

export type TransactionFileStatus =
  | "ACTIVE"
  | "MARKED_FOR_DELETION"
  | "DELETED";

export interface TransactionFile {
  id: string;
  transactionId: string;
  fileName: string;
  fileKey: string;
  previewFileUrl: string;
  downloadableFileUrl: string;
  fileSize: number;
  mimeType: string;
  status: TransactionFileStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  description: string;
  value: number;
  date: string;
  type: TransactionType;
  category: Category;
  files?: TransactionFile[];
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

export class ApiResponse<T> {
  data?: T;
  success: boolean = false;
  error?: string;
}

export interface UserSettings {
  info: {
    email: string;
  };
  notifications: {
    createTransaction: boolean;
    dailySummary: boolean;
  };
  provider: {
    enabled: boolean;
    telegramChatId: string | null;
  };
}
