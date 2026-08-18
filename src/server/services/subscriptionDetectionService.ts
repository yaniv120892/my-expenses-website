import { SubscriptionStatus } from '@prisma/client';
import prisma from '@/server/db/client';
import subscriptionRepository from '@/server/repositories/subscriptionRepository';
import scheduledTransactionService from '@/server/services/scheduledTransactionService';
import TransactionNotifierFactory from '@/server/services/transactionNotification/transactionNotifierFactory';
import {
  SubscriptionSummary,
  DetectedSubscriptionDomain,
  SubscriptionDashboardSnapshot,
  UpdateSubscriptionInput,
} from '@/shared/types/subscription';
import { normalizeMerchantName } from '@/server/utils/merchantNormalizer';
import { HttpError } from '@/server/http/errors';
import logger from '@/server/logging/logger';
import {
  nextExpectedDateAfter,
  roundToCents,
  toAnnualAmount,
  toMonthlyAmount,
} from '@/server/utils/subscriptionMath';
import {
  analyzeMerchantPattern,
  MerchantCharge,
  MerchantGroup,
} from '@/server/utils/subscriptionPattern';
import { findScheduleMatch } from '@/server/utils/scheduleMatching';
import { formatCurrency } from '@/utils/format';

const DETECTION_WINDOW_MONTHS = 12;

function groupByUser(
  subscriptions: DetectedSubscriptionDomain[],
): Map<string, DetectedSubscriptionDomain[]> {
  const byUser = new Map<string, DetectedSubscriptionDomain[]>();
  for (const sub of subscriptions) {
    const existing = byUser.get(sub.userId) || [];
    existing.push(sub);
    byUser.set(sub.userId, existing);
  }
  return byUser;
}

/** Null when this user has nothing worth notifying about. */
function buildAuditMessage(subs: DetectedSubscriptionDomain[]): string | null {
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
        `- ${sub.displayName}: ${formatCurrency(monthly)}/mo (${formatCurrency(sub.annualCost)}/yr)`,
      );
    }
    lines.push('');
    lines.push(
      `Total: ${formatCurrency(totalMonthly)}/month | ${formatCurrency(totalAnnual)}/year`,
    );
  }

  if (detected.length > 0) {
    lines.push(
      `${detected.length} new subscription${detected.length > 1 ? 's' : ''} detected — review in app`,
    );
  }

  return lines.join('\n');
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}

class SubscriptionDetectionService {
  public async runDetectionForAllUsers(): Promise<void> {
    const userIds = await subscriptionRepository.getAllUserIds();
    let failed = 0;
    for (const userId of userIds) {
      try {
        await this.detectForUser(userId);
      } catch (error) {
        failed += 1;
        logger.error(
          { err: error, userId },
          'Subscription detection failed for user',
        );
      }
    }

    logger.info(
      { total: userIds.length, succeeded: userIds.length - failed, failed },
      'Subscription detection run finished',
    );
    if (failed > 0) {
      // Surface partial failure so cron monitoring sees it.
      throw new Error(
        `Subscription detection failed for ${failed} of ${userIds.length} user(s)`,
      );
    }
  }

  public async getSubscriptions(
    userId: string,
    status?: SubscriptionStatus,
  ): Promise<SubscriptionSummary> {
    const subscriptions = await this.withScheduleMatches(
      userId,
      await subscriptionRepository.getByUserId(userId, status),
    );

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

    subscriptions.sort((a, b) => b.monthlyCost - a.monthlyCost);

    return {
      totalMonthlyEstimate,
      totalAnnualEstimate,
      activeCount,
      detectedCount,
      subscriptions,
    };
  }

  public async confirmSubscription(
    id: string,
    userId: string,
  ): Promise<DetectedSubscriptionDomain> {
    return subscriptionRepository.updateStatus(id, userId, 'CONFIRMED');
  }

  public async dismissSubscription(
    id: string,
    userId: string,
  ): Promise<DetectedSubscriptionDomain> {
    return subscriptionRepository.updateStatus(id, userId, 'DISMISSED');
  }

  /**
   * Applies the user's own figures. Annual cost is always derived, and the next
   * expected date follows the (possibly new) frequency unless given explicitly.
   */
  public async updateSubscription(
    id: string,
    userId: string,
    input: UpdateSubscriptionInput,
  ): Promise<DetectedSubscriptionDomain> {
    const existing = await subscriptionRepository.getById(id, userId);
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
      (rescheduled
        ? nextExpectedDateAfter(lastChargeDate, frequency)
        : existing.nextExpectedDate);

    try {
      return await subscriptionRepository.update(id, userId, {
        ...(input.displayName !== undefined
          ? { displayName: input.displayName }
          : {}),
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId }
          : {}),
        averageAmount: roundToCents(averageAmount),
        frequency,
        lastChargeDate,
        nextExpectedDate,
        annualCost: roundToCents(toAnnualAmount(averageAmount, frequency)),
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
    id: string,
    userId: string,
    categoryId?: string,
  ): Promise<DetectedSubscriptionDomain> {
    const subscription = await subscriptionRepository.getById(id, userId);
    if (!subscription) {
      throw new HttpError(404, 'Subscription not found');
    }

    const targetCategoryId = categoryId ?? subscription.categoryId;
    if (!targetCategoryId) {
      throw new HttpError(400, 'A category is required to schedule this');
    }

    const scheduledId =
      await scheduledTransactionService.createScheduledTransaction({
        description: subscription.displayName,
        value: subscription.averageAmount,
        type: 'EXPENSE',
        categoryId: targetCategoryId,
        scheduleType: subscription.frequency,
        userId,
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

    return subscriptionRepository.linkScheduledTransaction(
      id,
      userId,
      scheduledId,
    );
  }

  public async getDashboardSnapshot(
    userId: string,
  ): Promise<SubscriptionDashboardSnapshot> {
    return subscriptionRepository.getSnapshotByUserId(userId);
  }

  public async sendMonthlyAuditNotifications(): Promise<void> {
    const byUser = groupByUser(
      await subscriptionRepository.getActiveForAllUsers(),
    );
    const enabledUserIds = await this.getAuditEnabledUserIds(
      Array.from(byUser.keys()),
    );

    const notifier = TransactionNotifierFactory.getNotifier();

    let failed = 0;
    for (const [userId, subs] of byUser) {
      try {
        if (!enabledUserIds.has(userId)) continue;

        const message = buildAuditMessage(subs);
        if (!message) continue;

        await notifier.sendDailySummary(message, userId);
      } catch (error) {
        failed += 1;
        logger.error(
          { err: error, userId },
          'Failed to send subscription audit for user',
        );
      }
    }

    logger.info(
      { total: byUser.size, succeeded: byUser.size - failed, failed },
      'Subscription audit run finished',
    );
    if (failed > 0) {
      // Surface partial failure so cron monitoring sees it.
      throw new Error(
        `Subscription audit failed for ${failed} of ${byUser.size} user(s)`,
      );
    }
  }

  private async getAuditEnabledUserIds(
    userIds: string[],
  ): Promise<Set<string>> {
    const prefs = await prisma.userNotificationPreference.findMany({
      where: { userId: { in: userIds }, subscriptionAudit: true },
    });
    return new Set(prefs.map((p) => p.userId));
  }

  private async withScheduleMatches(
    userId: string,
    subscriptions: DetectedSubscriptionDomain[],
  ): Promise<DetectedSubscriptionDomain[]> {
    if (subscriptions.length === 0) return subscriptions;

    const schedules =
      await scheduledTransactionService.listScheduledTransactions(userId);
    return subscriptions.map((subscription) => ({
      ...subscription,
      scheduleMatch: findScheduleMatch(subscription, schedules),
    }));
  }

  private async detectForUser(userId: string): Promise<void> {
    const analyzedTo = new Date();
    const analyzedFrom = new Date(analyzedTo);
    analyzedFrom.setMonth(analyzedFrom.getMonth() - DETECTION_WINDOW_MONTHS);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        status: 'APPROVED',
        date: { gte: analyzedFrom },
      },
      select: { description: true, value: true, date: true, categoryId: true },
      orderBy: { date: 'asc' },
    });

    const existing = await subscriptionRepository.getByUserId(userId);
    const dismissed = new Set(
      existing
        .filter((s) => s.status === 'DISMISSED')
        .map((s) => `${s.merchantName}:${s.frequency}`),
    );
    const editedByMerchant = new Map(
      existing
        .filter((s) => s.userEditedAt)
        .map((s) => [s.merchantName, s] as const),
    );

    for (const group of this.groupByMerchant(transactions)) {
      const pattern = analyzeMerchantPattern(group, analyzedFrom, analyzedTo);
      if (!pattern) continue;

      if (dismissed.has(`${pattern.merchantKey}:${pattern.frequency}`)) {
        continue;
      }

      // The user's own figures win; only the detection-derived fields refresh.
      const edited = editedByMerchant.get(pattern.merchantKey);
      if (edited) {
        await subscriptionRepository.refreshDetection(edited.id, {
          lastChargeDate: pattern.lastChargeDate,
          nextExpectedDate: nextExpectedDateAfter(
            pattern.lastChargeDate,
            edited.frequency,
          ),
          matchingDescriptions: pattern.descriptions,
          confidence: pattern.confidence,
          detectionEvidence: pattern.evidence,
        });
        continue;
      }

      await subscriptionRepository.upsert({
        userId,
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
  }

  private groupByMerchant(transactions: MerchantCharge[]): MerchantGroup[] {
    const groups = new Map<string, MerchantGroup>();

    for (const tx of transactions) {
      const key = normalizeMerchantName(tx.description);
      if (!key) continue;

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

export default new SubscriptionDetectionService();
