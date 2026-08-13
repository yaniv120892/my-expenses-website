import scheduledTransactionRepository from '@/server/repositories/scheduledTransactionRepository';
import transactionService from '@/server/services/transactionService';
import { calculateNextRunDate } from '@/server/utils/scheduleDates';
import {
  CreateScheduledTransaction,
  UpdateScheduledTransaction,
  ScheduledTransactionDomain,
} from '@/shared/types/scheduledTransaction';
import logger from '@/server/logging/logger';

class ScheduledTransactionService {
  public async processDueScheduledTransactions(date: Date) {
    const dueScheduledTransactions =
      await scheduledTransactionRepository.getDueScheduledTransactions(date);
    let failed = 0;
    for (const scheduled of dueScheduledTransactions) {
      // Guarded per item so one failing schedule cannot abort the whole
      // cron run for every other user.
      try {
        const nextRunDate = calculateNextRunDate(
          scheduled.scheduleType,
          scheduled.interval,
          date,
          scheduled.dayOfWeek,
          scheduled.dayOfMonth,
        );
        // The schedule is advanced before the transaction is created and
        // rolled back if creation fails: a crash between the two steps then
        // skips one occurrence (reported below) instead of duplicating it on
        // every following run.
        await scheduledTransactionRepository.updateLastRunAndNextRun(
          scheduled.id,
          date,
          nextRunDate,
        );
        try {
          await transactionService.createTransaction({
            description: scheduled.description,
            value: scheduled.value,
            categoryId: scheduled.categoryId,
            type: scheduled.type,
            date,
            status: 'PENDING_APPROVAL',
            userId: scheduled.userId,
          });
        } catch (err) {
          await scheduledTransactionRepository.updateLastRunAndNextRun(
            scheduled.id,
            scheduled.lastRunDate ?? null,
            scheduled.nextRunDate ?? date,
          );
          throw err;
        }
      } catch (err) {
        failed += 1;
        logger.error(
          {
            err,
            scheduledTransactionId: scheduled.id,
            userId: scheduled.userId,
          },
          'Failed to process scheduled transaction',
        );
      }
    }

    logger.info(
      {
        total: dueScheduledTransactions.length,
        succeeded: dueScheduledTransactions.length - failed,
        failed,
      },
      'Scheduled transaction run finished',
    );
    if (failed > 0) {
      // Surface partial failure so cron monitoring sees it.
      throw new Error(
        `Scheduled transaction processing failed for ${failed} of ${dueScheduledTransactions.length} schedule(s)`,
      );
    }
  }

  public async createScheduledTransaction(
    data: CreateScheduledTransaction,
  ): Promise<string> {
    const nextRunDate = calculateNextRunDate(
      data.scheduleType,
      data.interval,
      new Date(),
      data.dayOfWeek,
      data.dayOfMonth,
    );
    return scheduledTransactionRepository.createScheduledTransaction(
      data,
      nextRunDate,
    );
  }

  public async updateScheduledTransaction(
    id: string,
    data: UpdateScheduledTransaction,
    userId: string,
  ): Promise<string> {
    const oldScheduledTransaction =
      await scheduledTransactionRepository.getScheduledTransactionById(
        id,
        userId,
      );
    const nextRunDate = calculateNextRunDate(
      data.scheduleType,
      data.interval,
      oldScheduledTransaction?.lastRunDate || new Date(),
      data.dayOfWeek,
      data.dayOfMonth,
    );
    return scheduledTransactionRepository.updateScheduledTransaction(
      id,
      data,
      userId,
      nextRunDate,
    );
  }

  public async listScheduledTransactions(
    userId: string,
  ): Promise<ScheduledTransactionDomain[]> {
    return scheduledTransactionRepository.getAllScheduledTransactions(userId);
  }

  public async deleteScheduledTransaction(
    id: string,
    userId: string,
  ): Promise<void> {
    return scheduledTransactionRepository.deleteScheduledTransaction(
      id,
      userId,
    );
  }
}

export default new ScheduledTransactionService();
