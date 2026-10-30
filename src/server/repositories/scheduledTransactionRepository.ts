import type { ScheduledTransaction } from '@/generated/prisma/client';
import prisma, { systemPrisma } from '@/server/db/client';
import type { HouseholdId } from '@/server/auth/householdActor.types';
import { toHouseholdId } from '@/server/auth/householdId';
import type {
  CreateScheduledTransaction,
  UpdateScheduledTransaction,
  ScheduledTransactionDomain,
} from '@/shared/types/scheduledTransaction';

// The household rides along so a cron acting on a due row stays inside it.
export type ScheduledHouseholdTransaction = ScheduledTransactionDomain & {
  householdId: HouseholdId;
};

class ScheduledTransactionRepository {
  public async createScheduledTransaction({
    householdId,
    userId,
    data,
    nextRunDate,
  }: {
    householdId: HouseholdId;
    userId: string | null;
    data: CreateScheduledTransaction;
    nextRunDate: Date;
  }): Promise<string> {
    const scheduledTransaction = await prisma.scheduledTransaction.create({
      data: {
        ...data,
        interval: data.interval === undefined ? null : data.interval,
        dayOfWeek: data.dayOfWeek === undefined ? null : data.dayOfWeek,
        dayOfMonth: data.dayOfMonth === undefined ? null : data.dayOfMonth,
        monthOfYear: data.monthOfYear === undefined ? null : data.monthOfYear,
        bankDescriptionPrefix: data.bankDescriptionPrefix ?? null,
        nextRunDate,
        householdId,
        userId,
      },
    });
    return scheduledTransaction.id;
  }

  public async getAllScheduledTransactions(
    householdId: HouseholdId,
  ): Promise<ScheduledHouseholdTransaction[]> {
    const scheduledTransactions = await prisma.scheduledTransaction.findMany({
      where: {
        householdId,
      },
      orderBy: {
        nextRunDate: 'asc',
      },
    });
    return scheduledTransactions.map(this.mapScheduledTransactionDbToDomain);
  }

  /** Across households: the cron runs every household's due schedules. */
  public async getDueScheduledTransactions(date: Date): Promise<ScheduledHouseholdTransaction[]> {
    const scheduledTransactions = await systemPrisma.scheduledTransaction.findMany({
      where: {
        nextRunDate: { lte: date },
      },
    });
    return scheduledTransactions.map(this.mapScheduledTransactionDbToDomain);
  }

  /**
   * Advances only if nextRunDate is still the value the caller read, so of two
   * overlapping runs exactly one claims the occurrence.
   */
  public async claimDueRun({
    householdId,
    id,
    readNextRunDate,
    lastRunDate,
    nextRunDate,
  }: {
    householdId: HouseholdId;
    id: string;
    readNextRunDate: Date | null;
    lastRunDate: Date;
    nextRunDate: Date;
  }): Promise<boolean> {
    const { count } = await prisma.scheduledTransaction.updateMany({
      where: { id, householdId, nextRunDate: readNextRunDate },
      data: { lastRunDate, nextRunDate },
    });
    return count > 0;
  }

  public async updateLastRunAndNextRun({
    householdId,
    id,
    lastRunDate,
    nextRunDate,
  }: {
    householdId: HouseholdId;
    id: string;
    lastRunDate: Date | null;
    nextRunDate: Date;
  }): Promise<void> {
    await prisma.scheduledTransaction.update({
      where: { id, householdId },
      data: { lastRunDate, nextRunDate },
    });
  }

  public async updateScheduledTransaction({
    householdId,
    id,
    data,
    nextRunDate,
  }: {
    householdId: HouseholdId;
    id: string;
    data: UpdateScheduledTransaction;
    nextRunDate: Date;
  }): Promise<string> {
    const scheduledTransaction = await prisma.scheduledTransaction.update({
      where: { id, householdId },
      data: {
        ...data,
        interval: data.interval === undefined ? null : data.interval,
        dayOfWeek: data.dayOfWeek === undefined ? null : data.dayOfWeek,
        dayOfMonth: data.dayOfMonth === undefined ? null : data.dayOfMonth,
        monthOfYear: data.monthOfYear === undefined ? null : data.monthOfYear,
        bankDescriptionPrefix: data.bankDescriptionPrefix ?? null,
        nextRunDate,
      },
    });
    return scheduledTransaction.id;
  }

  public async deleteScheduledTransaction(householdId: HouseholdId, id: string): Promise<void> {
    await prisma.scheduledTransaction.delete({ where: { id, householdId } });
  }

  public async getScheduledTransactionById(
    householdId: HouseholdId,
    id: string,
  ): Promise<ScheduledHouseholdTransaction | null> {
    const scheduledTransaction = await prisma.scheduledTransaction.findUnique({
      where: { id, householdId },
    });

    if (!scheduledTransaction) {
      return null;
    }
    return this.mapScheduledTransactionDbToDomain(scheduledTransaction);
  }

  private mapScheduledTransactionDbToDomain(
    db: ScheduledTransaction,
  ): ScheduledHouseholdTransaction {
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
      bankDescriptionPrefix: db.bankDescriptionPrefix ?? undefined,
      lastRunDate: db.lastRunDate === null ? undefined : db.lastRunDate,
      nextRunDate: db.nextRunDate === null ? undefined : db.nextRunDate,
      householdId: toHouseholdId(db.householdId),
    };
  }
}

const scheduledTransactionRepository = new ScheduledTransactionRepository();
export default scheduledTransactionRepository;
