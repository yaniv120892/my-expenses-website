import { TransactionType, TransactionStatus } from '@/shared/types/transaction';
import { ScheduleType } from '@prisma/client';

export interface CreateTransactionDbModel {
  description: string;
  value: number;
  categoryId: string;
  type: TransactionType;
  date: Date;
  status?: TransactionStatus;
  userId: string;
}

export interface UpdateTransactionDbModel {
  description?: string;
  value?: number;
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
