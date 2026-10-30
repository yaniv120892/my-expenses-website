import scheduledTransactionRepository from '@/server/repositories/scheduledTransactionRepository';
import crossHouseholdRepository from '@/server/repositories/crossHouseholdRepository';
import transactionService from '@/server/services/transactionService';
import { calculateNextRunDate } from '@/shared/scheduleDates';
import type {
  CreateScheduledTransaction,
  UpdateScheduledTransaction,
  ScheduledTransactionDomain,
} from '@/shared/types/scheduledTransaction';
import { logger } from '@/server/observability';
import { actingUserId, systemActor } from '@/server/auth/householdActor';
import type { HouseholdActor, HouseholdId } from '@/server/auth/householdActor.types';
import type { ScheduledHouseholdTransaction } from '@/server/repositories/scheduledTransactionRepository.types';

class ScheduledTransactionService {
  public async processDueScheduledTransactions(date: Date) {
    const dueScheduledTransactions =
      await crossHouseholdRepository.findDueScheduledTransactions(date);
    let failed = 0;
    let skipped = 0;
    for (const scheduled of dueScheduledTransactions) {
      try {
        const nextRunDate = calculateNextRunDate(
          scheduled.scheduleType,
          scheduled.interval,
          date,
          scheduled.dayOfWeek,
          scheduled.dayOfMonth,
        );
        // Advanced before creation and rolled back on failure, so a crash
        // between the two skips one occurrence instead of duplicating it every
        // run.
        const claimed = await scheduledTransactionRepository.claimDueRun({
          householdId: scheduled.householdId,
          id: scheduled.id,
          readNextRunDate: scheduled.nextRunDate ?? null,
          lastRunDate: date,
          nextRunDate,
        });
        if (!claimed) {
          skipped += 1;
          continue;
        }
        try {
          await this.projectOccurrence(scheduled, date);
        } catch (err) {
          await scheduledTransactionRepository.updateLastRunAndNextRun({
            householdId: scheduled.householdId,
            id: scheduled.id,
            lastRunDate: scheduled.lastRunDate ?? null,
            nextRunDate: scheduled.nextRunDate ?? date,
          });
          throw err;
        }
      } catch (err) {
        failed += 1;
        logger.error(
          {
            err,
            scheduledTransactionId: scheduled.id,
            householdId: scheduled.householdId,
          },
          'Failed to process scheduled transaction',
        );
      }
    }

    logger.info(
      {
        total: dueScheduledTransactions.length,
        succeeded: dueScheduledTransactions.length - failed - skipped,
        skipped,
        failed,
      },
      'Scheduled transaction run finished',
    );
    if (failed > 0) {
      throw new Error(
        `Scheduled transaction processing failed for ${failed} of ${dueScheduledTransactions.length} schedule(s)`,
      );
    }
  }

  public async createScheduledTransaction(
    actor: HouseholdActor,
    data: CreateScheduledTransaction,
  ): Promise<string> {
    const nextRunDate = calculateNextRunDate(
      data.scheduleType,
      data.interval,
      new Date(),
      data.dayOfWeek,
      data.dayOfMonth,
    );
    return scheduledTransactionRepository.createScheduledTransaction({
      householdId: actor.householdId,
      userId: actingUserId(actor),
      data,
      nextRunDate,
    });
  }

  public async updateScheduledTransaction(
    actor: HouseholdActor,
    id: string,
    data: UpdateScheduledTransaction,
  ): Promise<string> {
    const oldScheduledTransaction =
      await scheduledTransactionRepository.getScheduledTransactionById(actor.householdId, id);
    const nextRunDate = calculateNextRunDate(
      data.scheduleType,
      data.interval,
      oldScheduledTransaction?.lastRunDate || new Date(),
      data.dayOfWeek,
      data.dayOfMonth,
    );
    return scheduledTransactionRepository.updateScheduledTransaction({
      householdId: actor.householdId,
      id,
      data,
      nextRunDate,
    });
  }

  public async listScheduledTransactions(
    householdId: HouseholdId,
  ): Promise<ScheduledTransactionDomain[]> {
    return scheduledTransactionRepository.getAllScheduledTransactions(householdId);
  }

  public async deleteScheduledTransaction(actor: HouseholdActor, id: string): Promise<void> {
    return scheduledTransactionRepository.deleteScheduledTransaction(actor.householdId, id);
  }

  // The occurrence lands in the schedule's own household, written by the cron.
  private async projectOccurrence(scheduled: ScheduledHouseholdTransaction, date: Date) {
    await transactionService.createTransaction(
      systemActor({ householdId: scheduled.householdId, job: 'scheduled-transactions' }),
      {
        description: scheduled.description,
        value: scheduled.value,
        categoryId: scheduled.categoryId,
        type: scheduled.type,
        date,
        status: 'PENDING_APPROVAL',
        scheduledTransactionId: scheduled.id,
      },
    );
  }
}

const scheduledTransactionService = new ScheduledTransactionService();
export default scheduledTransactionService;
