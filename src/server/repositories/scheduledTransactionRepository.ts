import { ScheduledTransaction } from '@prisma/client';
import prisma from '@/server/db/client';
import {
  CreateScheduledTransaction,
  UpdateScheduledTransaction,
  ScheduledTransactionDomain,
} from '@/shared/types/scheduledTransaction';

class ScheduledTransactionRepository {
  public async createScheduledTransaction(
    data: CreateScheduledTransaction,
    nextRunDate: Date,
  ): Promise<string> {
    const scheduledTransaction = await prisma.scheduledTransaction.create({
      data: {
        ...data,
        interval: data.interval === undefined ? null : data.interval,
        dayOfWeek: data.dayOfWeek === undefined ? null : data.dayOfWeek,
        dayOfMonth: data.dayOfMonth === undefined ? null : data.dayOfMonth,
        monthOfYear: data.monthOfYear === undefined ? null : data.monthOfYear,
        nextRunDate,
        userId: data.userId,
      },
    });
    return scheduledTransaction.id;
  }

  public async getAllScheduledTransactions(
    userId: string,
  ): Promise<ScheduledTransactionDomain[]> {
    const scheduledTransactions = await prisma.scheduledTransaction.findMany({
      where: {
        userId,
      },
      orderBy: {
        nextRunDate: 'asc',
      },
    });
    return scheduledTransactions.map(this.mapScheduledTransactionDbToDomain);
  }

  public async getDueScheduledTransactions(
    date: Date,
  ): Promise<ScheduledTransactionDomain[]> {
    const scheduledTransactions = await prisma.scheduledTransaction.findMany({
      where: {
        nextRunDate: { lte: date },
      },
    });
    return scheduledTransactions.map(this.mapScheduledTransactionDbToDomain);
  }

  public async updateLastRunAndNextRun(
    id: string,
    lastRunDate: Date,
    nextRunDate: Date,
  ): Promise<void> {
    await prisma.scheduledTransaction.update({
      where: { id },
      data: { lastRunDate, nextRunDate },
    });
  }

  public async updateScheduledTransaction(
    id: string,
    data: UpdateScheduledTransaction,
    userId: string,
    nextRunDate: Date,
  ): Promise<string> {
    const scheduledTransaction = await prisma.scheduledTransaction.update({
      where: { id, userId },
      data: {
        ...data,
        interval: data.interval === undefined ? null : data.interval,
        dayOfWeek: data.dayOfWeek === undefined ? null : data.dayOfWeek,
        dayOfMonth: data.dayOfMonth === undefined ? null : data.dayOfMonth,
        monthOfYear: data.monthOfYear === undefined ? null : data.monthOfYear,
        nextRunDate,
      },
    });
    return scheduledTransaction.id;
  }

  public async deleteScheduledTransaction(
    id: string,
    userId: string,
  ): Promise<void> {
    await prisma.scheduledTransaction.delete({ where: { id, userId } });
  }

  public async getScheduledTransactionById(
    id: string,
    userId: string,
  ): Promise<ScheduledTransactionDomain | null> {
    const scheduledTransaction = await prisma.scheduledTransaction.findUnique({
      where: { id, userId },
    });

    if (!scheduledTransaction) {
      return null;
    }
    return this.mapScheduledTransactionDbToDomain(scheduledTransaction);
  }

  private mapScheduledTransactionDbToDomain(
    db: ScheduledTransaction,
  ): ScheduledTransactionDomain {
    return {
      id: db.id,
      description: db.description,
      value: db.value,
      type: db.type,
      categoryId: db.categoryId,
      scheduleType: db.scheduleType,
      interval: db.interval === null ? undefined : db.interval,
      dayOfWeek: db.dayOfWeek === null ? undefined : db.dayOfWeek,
      dayOfMonth: db.dayOfMonth === null ? undefined : db.dayOfMonth,
      monthOfYear: db.monthOfYear === null ? undefined : db.monthOfYear,
      lastRunDate: db.lastRunDate === null ? undefined : db.lastRunDate,
      nextRunDate: db.nextRunDate === null ? undefined : db.nextRunDate,
      userId: db.userId,
    };
  }
}

export default new ScheduledTransactionRepository();
