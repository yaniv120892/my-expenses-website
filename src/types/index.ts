// Client entry point for domain types. Shared definitions live in
// src/shared/types; only client-specific shapes (JSON wire formats with
// string dates, UI-only types) are declared here, derived from the shared
// tree so the two cannot drift.
import type { Category } from '@/shared/types/category';
import type {
  CreateScheduledTransaction,
  ScheduledTransactionDomain,
  UpdateScheduledTransaction,
} from '@/shared/types/scheduledTransaction';
import type {
  Transaction as SharedTransaction,
  TransactionFile as SharedTransactionFile,
  TransactionType,
} from '@/shared/types/transaction';
import type { updateUserSettingsSchema } from '@/shared/schemas/userSettings';
import type { z } from 'zod';

export type { Category, TransactionType };
export type {
  TransactionFileStatus,
  TransactionSummary,
} from '@/shared/types/transaction';

export type TransactionFile = Omit<
  SharedTransactionFile,
  'createdAt' | 'updatedAt'
> & {
  previewFileUrl: string;
  downloadableFileUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type Transaction = Omit<
  SharedTransaction,
  'date' | 'status' | 'category' | 'files'
> & {
  date: string;
  category: Category;
  files?: TransactionFile[];
};

// Request body for POST/PUT /api/transactions; dates travel as strings and
// are coerced by createTransactionSchema on the server.
export interface CreateTransactionInput {
  description: string;
  value: number;
  categoryId: string | undefined;
  type: TransactionType;
  date: string;
}

export type UpdateTransactionInput = CreateTransactionInput;

// Client-side query state for /api/transactions; dates travel as strings.
// Paging is not part of it — the list pages by cursor, and the same filters
// drive the summary totals.
export interface TransactionFilters {
  searchTerm?: string;
  categoryId?: string;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
}

export type ScheduleType = ScheduledTransactionDomain['scheduleType'];

export type CreateScheduledTransactionInput = Omit<
  CreateScheduledTransaction,
  'userId'
>;

export type UpdateScheduledTransactionInput = UpdateScheduledTransaction;

export type ScheduledTransaction = Omit<
  ScheduledTransactionDomain,
  'userId' | 'lastRunDate' | 'nextRunDate'
> & {
  lastRunDate?: string;
  nextRunDate: string;
};

export class ApiResponse<T> {
  data?: T;
  success: boolean = false;
  error?: string;
}

export type UserSettings = z.infer<typeof updateUserSettingsSchema>;
