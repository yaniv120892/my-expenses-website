// Client-only shapes (JSON wire formats with string dates, UI-only types),
// derived from src/shared/types so the two cannot drift.
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

// Dates travel as strings and are coerced by createTransactionSchema.
export interface CreateTransactionInput {
  description: string;
  value: number;
  categoryId: string | undefined;
  type: TransactionType;
  date: string;
}

export type UpdateTransactionInput = CreateTransactionInput;

// No paging: the list pages by cursor, and the same filters drive the summary
// totals.
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
  public data?: T;
  public success: boolean = false;
  public error?: string;
}

export type UserSettings = z.infer<typeof updateUserSettingsSchema>;
