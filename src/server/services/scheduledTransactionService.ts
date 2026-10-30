import scheduledTransactionRepository from '@/server/repositories/scheduledTransactionRepository';
import householdActivityService from '@/server/services/householdActivityService';
import type { ActivityEntry } from '@/server/services/householdActivityService';
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
import type { ScheduledHouseholdTransaction } from '@/server/repositories/scheduledTransactionRepository';

class ScheduledTransactionService {
  public async processDueScheduledTransactions(date: Date) {
    const dueScheduledTransactions =
      await scheduledTransactionRepository.getDueScheduledTransactions(date);
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
    return householdActivityService.record({
      actor,
      write: () =>
        scheduledTransactionRepository.createScheduledTransaction({
          householdId: actor.householdId,
          userId: actingUserId(actor),
          data,
          nextRunDate,
        }),
      describe: (id) => scheduleActivity({ action: 'CREATE', id, description: data.description }),
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
    return householdActivityService.record({
      actor,
      write: () =>
        scheduledTransactionRepository.updateScheduledTransaction({
          householdId: actor.householdId,
          id,
          data,
          nextRunDate,
        }),
      describe: (updatedId) =>
        scheduleActivity({ action: 'UPDATE', id: updatedId, description: data.description }),
    });
  }

  public async listScheduledTransactions(
    householdId: HouseholdId,
  ): Promise<ScheduledTransactionDomain[]> {
    return scheduledTransactionRepository.getAllScheduledTransactions(householdId);
  }

  public async deleteScheduledTransaction(actor: HouseholdActor, id: string): Promise<void> {
    await householdActivityService.record({
      actor,
      write: async () => {
        const existing = await scheduledTransactionRepository.getScheduledTransactionById(
          actor.householdId,
          id,
        );
        await scheduledTransactionRepository.deleteScheduledTransaction(actor.householdId, id);
        return existing;
      },
      describe: (deleted) =>
        deleted && scheduleActivity({ action: 'DELETE', id, description: deleted.description }),
    });
  }

  // The occurrence lands in the schedule's own household, written by the cron;
  // createTransaction records it as the cron's CREATE.
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

function scheduleActivity({
  action,
  id,
  description,
}: {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  id: string;
  description: string;
}): ActivityEntry {
  return { action, entityType: 'SCHEDULED_TRANSACTION', entityId: id, summary: description };
}

const scheduledTransactionService = new ScheduledTransactionService();
export default scheduledTransactionService;
