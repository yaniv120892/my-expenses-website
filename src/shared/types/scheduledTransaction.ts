import type { TransactionType } from './transaction';
import type { ScheduleType } from '@/generated/prisma/enums';

export type CreateScheduledTransaction = {
  description: string;
  value: number;
  type: TransactionType;
  categoryId: string;
  scheduleType: ScheduleType;
  interval?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  bankDescriptionPrefix?: string;
  userId: string;
};

export type UpdateScheduledTransaction = {
  description: string;
  value: number;
  type: TransactionType;
  categoryId: string;
  scheduleType: ScheduleType;
  interval?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  bankDescriptionPrefix?: string;
};

export type ScheduledTransactionDomain = {
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
  bankDescriptionPrefix?: string;
  lastRunDate?: Date;
  nextRunDate?: Date;
  userId: string;
};
