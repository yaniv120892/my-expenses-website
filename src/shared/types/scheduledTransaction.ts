import { TransactionType } from './transaction';
import { ScheduleType } from '@/generated/prisma/enums';

export interface CreateScheduledTransaction {
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
}

export interface UpdateScheduledTransaction {
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
}

export interface ScheduledTransactionDomain {
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
}
