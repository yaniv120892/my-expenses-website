import type { SubscriptionStatus } from '@/generated/prisma/client';
import prisma from '@/server/db/client';
import type { HouseholdActor, HouseholdId } from '@/server/auth/householdActor.types';
import householdRepository from '@/server/repositories/householdRepository';
import userRepository from '@/server/repositories/userRepository';
import type {
  DetectionInput,
  SubscriptionAuditRow,
} from '@/server/repositories/subscriptionRepository';
import subscriptionRepository from '@/server/repositories/subscriptionRepository';
import householdActivityService from '@/server/services/householdActivityService';
import type { ActivityEntry } from '@/server/services/householdActivityService.types';
import scheduledTransactionService from '@/server/services/scheduledTransactionService';
import transactionNotifierFactory from '@/server/services/transactionNotification/transactionNotifierFactory';
import type {
  SubscriptionSummary,
  DetectedSubscriptionDomain,
  SubscriptionDashboardSnapshot,
  UpdateSubscriptionInput,
} from '@/shared/types/subscription';
import { normalizeMerchantName } from '@/server/utils/merchantNormalizer';
import { HttpError } from '@/server/http/errors';
import { getPrismaErrorCode, PRISMA_ERROR_CODES } from '@/server/db/prismaErrors';
import { escapeMarkdown } from '@/server/services/telegramService';
import { logger } from '@/server/observability';
import {
  nextExpectedDateAfter,
  roundToCents,
  toAnnualAmount,
  toMonthlyAmount,
} from '@/utils/subscriptionMath';
import type { MerchantCharge, MerchantGroup } from '@/server/utils/subscriptionPattern';
import { analyzeMerchantPattern } from '@/server/utils/subscriptionPattern';
import { findScheduleMatch, indexSchedules } from '@/server/utils/scheduleMatching';
import { formatCurrencyPlain } from '@/utils/format';

const DETECTION_WINDOW_MONTHS = 12;

/** Null when this user has nothing worth notifying about. */
function buildAuditMessage(subs: SubscriptionAuditRow[]): string | null {
  const confirmed = subs.filter((s) => s.status === 'CONFIRMED');
  const detected = subs.filter((s) => s.status === 'DETECTED');

  if (confirmed.length === 0 && detected.length === 0) {
    return null;
  }

  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'long' });
  const lines = [`Subscription Audit — ${monthName} ${now.getFullYear()}`, ''];

  if (confirmed.length > 0) {
    lines.push('Active Subscriptions:');
    let totalMonthly = 0;
    let totalAnnual = 0;
    for (const sub of confirmed) {
      const monthly = toMonthlyAmount(sub.averageAmount, sub.frequency);
      totalMonthly += monthly;
      totalAnnual += sub.annualCost;
      lines.push(
        `- ${sub.displayName}: ${formatCurrencyPlain(monthly)}/mo (${formatCurrencyPlain(sub.annualCost)}/yr)`,
      );
    }
    lines.push('');
    lines.push(
      `Total: ${formatCurrencyPlain(totalMonthly)}/month | ${formatCurrencyPlain(totalAnnual)}/year`,
    );
  }

  if (detected.length > 0) {
    lines.push(
      `${detected.length} new subscription${detected.length > 1 ? 's' : ''} detected — review in app`,
    );
  }

  // The whole message is data — no intended Markdown — but it rides the same
  // Markdown-parsed notifier path as the daily summary, so escape it all.
  return escapeMarkdown(lines.join('\n'));
}

function isUniqueViolation(error: unknown): boolean {
  return getPrismaErrorCode(error) === PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT_VIOLATION;
}

class SubscriptionDetectionService {
  public async runDetectionForAllHouseholds(): Promise<void> {
    const householdIds = await householdRepository.listIds();
    let failed = 0;
    for (const householdId of householdIds) {
      try {
        await this.detectForHousehold(householdId);
      } catch (error) {
        failed += 1;
        logger.error({ err: error, householdId }, 'Subscription detection failed for household');
      }
    }

    logger.info(
      { total: householdIds.length, succeeded: householdIds.length - failed, failed },
      'Subscription detection run finished',
    );
    if (failed > 0) {
      throw new Error(
        `Subscription detection failed for ${failed} of ${householdIds.length} household(s)`,
      );
    }
  }

  public async getSubscriptions(
    householdId: HouseholdId,
    status?: SubscriptionStatus,
  ): Promise<SubscriptionSummary> {
    const [stored, schedules] = await Promise.all([
      subscriptionRepository.getByHousehold(householdId, status),
      scheduledTransactionService.listScheduledTransactions(householdId),
    ]);

    const indexed = indexSchedules(schedules);
    const subscriptions = stored.map((subscription) => ({
      ...subscription,
      scheduleMatch: findScheduleMatch(subscription, indexed),
    }));

    let totalMonthlyEstimate = 0;
    let totalAnnualEstimate = 0;
    let activeCount = 0;
    let detectedCount = 0;

    for (const s of subscriptions) {
      if (s.status === 'CONFIRMED') {
        activeCount++;
      } else if (s.status === 'DETECTED') {
        detectedCount++;
      } else {
        continue;
      }
      totalMonthlyEstimate += s.monthlyCost;
      totalAnnualEstimate += s.annualCost;
    }

    return {
      totalMonthlyEstimate,
      totalAnnualEstimate,
      activeCount,
      detectedCount,
      subscriptions,
    };
  }

  public async confirmSubscription(
    actor: HouseholdActor,
    id: string,
  ): Promise<DetectedSubscriptionDomain> {
    return householdActivityService.record({
      actor,
      write: () => subscriptionRepository.updateStatus(actor.householdId, id, 'CONFIRMED'),
      describe: (confirmed) => subscriptionActivity('CONFIRM', confirmed),
    });
  }

  public async dismissSubscription(
    actor: HouseholdActor,
    id: string,
  ): Promise<DetectedSubscriptionDomain> {
    return householdActivityService.record({
      actor,
      write: () => subscriptionRepository.updateStatus(actor.householdId, id, 'DISMISSED'),
      describe: (dismissed) => subscriptionActivity('DISMISS', dismissed),
    });
  }

  /**
   * Annual cost is always derived, and the next expected date follows the
   * (possibly new) frequency unless the caller gave one explicitly.
   */
  public async updateSubscription(
    actor: HouseholdActor,
    id: string,
    input: UpdateSubscriptionInput,
  ): Promise<DetectedSubscriptionDomain> {
    const existing = await subscriptionRepository.getById(actor.householdId, id);
    if (!existing) {
      throw new HttpError(404, 'Subscription not found');
    }

    const frequency = input.frequency ?? existing.frequency;
    const averageAmount = input.averageAmount ?? existing.averageAmount;
    const lastChargeDate = input.lastChargeDate ?? existing.lastChargeDate;
    const rescheduled =
      frequency !== existing.frequency ||
      lastChargeDate.getTime() !== existing.lastChargeDate.getTime();
    const nextExpectedDate =
      input.nextExpectedDate ??
      (rescheduled ? nextExpectedDateAfter(lastChargeDate, frequency) : existing.nextExpectedDate);

    try {
      return await householdActivityService.record({
        actor,
        write: () =>
          subscriptionRepository.update(actor.householdId, id, {
            displayName: input.displayName,
            categoryId: input.categoryId,
            averageAmount: roundToCents(averageAmount),
            frequency,
            lastChargeDate,
            nextExpectedDate,
            annualCost: roundToCents(toAnnualAmount(averageAmount, frequency)),
          }),
        describe: (updated) => subscriptionActivity('UPDATE', updated),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError(
          409,
          'Another subscription already tracks this merchant at that frequency',
        );
      }
      throw error;
    }
  }

  public async convertToScheduledTransaction(
    actor: HouseholdActor,
    id: string,
    categoryId?: string,
  ): Promise<DetectedSubscriptionDomain> {
    const subscription = await subscriptionRepository.getById(actor.householdId, id);
    if (!subscription) {
      throw new HttpError(404, 'Subscription not found');
    }

    if (subscription.scheduledTransactionId) {
      throw new HttpError(
        409,
        `Subscription is already scheduled as ${subscription.scheduledTransactionId}`,
      );
    }

    const targetCategoryId = categoryId ?? subscription.categoryId;
    if (!targetCategoryId) {
      throw new HttpError(400, 'A category is required to schedule this');
    }

    // The schedule records its own CREATE, inside this record's transaction.
    return householdActivityService.record({
      actor,
      write: async () => {
        const scheduledId = await scheduledTransactionService.createScheduledTransaction(actor, {
          description: subscription.displayName,
          value: subscription.averageAmount,
          type: 'EXPENSE',
          categoryId: targetCategoryId,
          scheduleType: subscription.frequency,
          dayOfMonth:
            subscription.frequency === 'MONTHLY'
              ? subscription.lastChargeDate.getDate()
              : undefined,
          // The app-wide dayOfWeek convention is 1=Sunday..7=Saturday, while
          // getDay() is 0-based.
          dayOfWeek:
            subscription.frequency === 'WEEKLY'
              ? subscription.lastChargeDate.getDay() + 1
              : undefined,
        });
        return subscriptionRepository.linkScheduledTransaction(actor.householdId, id, scheduledId);
      },
      describe: (linked) => subscriptionActivity('UPDATE', linked),
    });
  }

  public async getDashboardSnapshot(
    householdId: HouseholdId,
  ): Promise<SubscriptionDashboardSnapshot> {
    return subscriptionRepository.getSnapshot(householdId);
  }

  public async sendMonthlyAuditNotifications(): Promise<void> {
    const recipients = await userRepository.findReportRecipients('subscriptionAudit');
    const notifier = transactionNotifierFactory.getNotifier();
    const messageByHousehold = new Map<HouseholdId, string | null>();

    let failed = 0;
    for (const { userId, householdId } of recipients) {
      try {
        let message = messageByHousehold.get(householdId);
        if (message === undefined) {
          message = buildAuditMessage(await subscriptionRepository.getActive(householdId));
          messageByHousehold.set(householdId, message);
        }
        if (!message) {
          continue;
        }

        await notifier.sendDailySummary(message, userId);
      } catch (error) {
        failed += 1;
        logger.error({ err: error, userId }, 'Failed to send subscription audit for user');
      }
    }

    logger.info(
      { total: recipients.length, succeeded: recipients.length - failed, failed },
      'Subscription audit run finished',
    );
    if (failed > 0) {
      throw new Error(`Subscription audit failed for ${failed} of ${recipients.length} user(s)`);
    }
  }

  private async detectForHousehold(householdId: HouseholdId): Promise<void> {
    const analyzedTo = new Date();
    const analyzedFrom = new Date(analyzedTo);
    analyzedFrom.setMonth(analyzedFrom.getMonth() - DETECTION_WINDOW_MONTHS);

    const transactions = await prisma.transaction.findMany({
      where: {
        householdId,
        type: 'EXPENSE',
        status: 'APPROVED',
        date: { gte: analyzedFrom },
      },
      select: { description: true, value: true, date: true, categoryId: true },
      orderBy: { date: 'asc' },
    });

    const results: DetectionInput[] = [];
    for (const group of this.groupByMerchant(transactions)) {
      const pattern = analyzeMerchantPattern(group, analyzedFrom, analyzedTo);
      if (!pattern) {
        continue;
      }

      results.push({
        merchantName: pattern.merchantKey,
        displayName: pattern.displayName,
        averageAmount: pattern.averageAmount,
        frequency: pattern.frequency,
        lastChargeDate: pattern.lastChargeDate,
        nextExpectedDate: pattern.nextExpectedDate,
        annualCost: pattern.annualCost,
        matchingDescriptions: pattern.descriptions,
        confidence: pattern.confidence,
        categoryId: pattern.categoryId,
        detectionEvidence: pattern.evidence,
      });
    }

    await subscriptionRepository.applyDetectionResults(householdId, results);
  }

  private groupByMerchant(transactions: MerchantCharge[]): MerchantGroup[] {
    const groups = new Map<string, MerchantGroup>();

    for (const tx of transactions) {
      const key = normalizeMerchantName(tx.description);
      if (!key) {
        continue;
      }

      const existing = groups.get(key);
      if (existing) {
        existing.charges.push(tx);
      } else {
        groups.set(key, { merchantKey: key, charges: [tx] });
      }
    }

    return Array.from(groups.values());
  }
}

function subscriptionActivity(
  action: 'CONFIRM' | 'DISMISS' | 'UPDATE',
  subscription: DetectedSubscriptionDomain,
): ActivityEntry {
  return {
    action,
    entityType: 'SUBSCRIPTION',
    entityId: subscription.id,
    summary: subscription.displayName,
  };
}

const subscriptionDetectionService = new SubscriptionDetectionService();
export default subscriptionDetectionService;
