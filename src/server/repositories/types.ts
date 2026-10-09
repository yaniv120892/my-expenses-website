import {
  TransactionAmount,
  TransactionType,
  TransactionStatus,
} from '@/shared/types/transaction';
import { ScheduleType } from '@/generated/prisma/client';

export interface CreateTransactionDbModel extends TransactionAmount {
  description: string;
  categoryId: string;
  type: TransactionType;
  date: Date;
  status?: TransactionStatus;
  userId: string;
}

export interface UpdateTransactionDbModel {
  description?: string;
  /** Replaces every amount field together, so a conversion never half-changes. */
  amount?: TransactionAmount;
  categoryId?: string;
  type?: TransactionType;
  date?: Date;
  status?: TransactionStatus;
}

export interface CreateScheduledTransactionDbModel {
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
  lastRunDate?: Date;
  nextRunDate?: Date;
}

export interface UserQuery {
  isVerified?: boolean;
}
