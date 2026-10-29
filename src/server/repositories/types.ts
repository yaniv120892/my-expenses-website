import type {
  Transaction,
  TransactionAmount,
  TransactionType,
  TransactionStatus,
} from '@/shared/types/transaction';
import type { ScheduleType } from '@/generated/prisma/client';

export type CreateTransactionDbModel = {
  description: string;
  categoryId: string;
  type: TransactionType;
  date: Date;
  status?: TransactionStatus;
  scheduledTransactionId?: string;
  userId: string;
} & TransactionAmount;

export type MatchCandidateTransaction = Transaction & {
  bankDescriptionPrefix: string | null;
};

export type UpdateTransactionDbModel = {
  description?: string;
  /** Replaces every amount field together, so a conversion never half-changes. */
  amount?: TransactionAmount;
  categoryId?: string;
  type?: TransactionType;
  date?: Date;
  status?: TransactionStatus;
};

export type CreateScheduledTransactionDbModel = {
  description: string;
  value: number;
  type: TransactionType;
  categoryId: string;
  scheduleType: ScheduleType;
  interval?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
};

export type ScheduledTransaction = {
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
  lastRunDate?: Date;
  nextRunDate?: Date;
};

export type UserQuery = {
  isVerified?: boolean;
};
