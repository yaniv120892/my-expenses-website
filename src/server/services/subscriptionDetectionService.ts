import { SubscriptionFrequency, SubscriptionStatus } from '@prisma/client';
import { addWeeks, addMonths, addYears } from 'date-fns';
import prisma from '@/server/db/client';
import subscriptionRepository from '@/server/repositories/subscriptionRepository';
import scheduledTransactionService from '@/server/services/scheduledTransactionService';
import TransactionNotifierFactory from '@/server/services/transactionNotification/transactionNotifierFactory';
import {
  SubscriptionSummary,
  DetectedSubscriptionDomain,
  SubscriptionDashboardSnapshot,
} from '@/shared/types/subscription';
import {
  normalizeMerchantName,
  toDisplayName,
} from '@/server/utils/merchantNormalizer';
import logger from '@/server/logging/logger';
import { toMonthlyAmount } from '@/server/utils/subscriptionMath';

interface TransactionGroup {
  merchantKey: string;
  descriptions: string[];
  amounts: number[];
  dates: Date[];
}

interface DetectedPattern {
  merchantKey: string;
  displayName: string;
  frequency: SubscriptionFrequency;
  averageAmount: number;
  lastChargeDate: Date;
  nextExpectedDate: Date;
  annualCost: number;
  descriptions: string[];
  confidence: number;
}

class SubscriptionDetectionService {
  public async runDetectionForAllUsers(): Promise<void> {
    const userIds = await subscriptionRepository.getAllUserIds();
    for (const userId of userIds) {
      try {
        await this.detectForUser(userId);
      } catch (error) {
        logger.error(
          { err: error, userId },
          'Subscription detection failed for user',
        );
      }
    }
  }

  public async getSubscriptions(
    userId: string,
    status?: SubscriptionStatus,
  ): Promise<SubscriptionSummary> {
    const subscriptions = await subscriptionRepository.getByUserId(
      userId,
      status,
    );

    let totalMonthlyEstimate = 0;
    let totalAnnualEstimate = 0;
    let activeCount = 0;
    let detectedCount = 0;

    for (const s of subscriptions) {
      if (s.status === 'CONFIRMED') {
        activeCount++;
        totalMonthlyEstimate += toMonthlyAmount(s.averageAmount, s.frequency);
        totalAnnualEstimate += s.annualCost;
      } else if (s.status === 'DETECTED') {
        detectedCount++;
        totalMonthlyEstimate += toMonthlyAmount(s.averageAmount, s.frequency);
        totalAnnualEstimate += s.annualCost;
      }
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

  public async convertToScheduledTransaction(
    id: string,
    userId: string,
    categoryId: string,
  ): Promise<DetectedSubscriptionDomain> {
    const subscription = await subscriptionRepository.getById(id, userId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const scheduledId =
      await scheduledTransactionService.createScheduledTransaction({
        description: subscription.displayName,
        value: subscription.averageAmount,
        type: 'EXPENSE',
        categoryId,
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
    const allActive = await subscriptionRepository.getActiveForAllUsers();
    const byUser = new Map<string, DetectedSubscriptionDomain[]>();

    for (const sub of allActive) {
      const existing = byUser.get(sub.userId) || [];
      existing.push(sub);
      byUser.set(sub.userId, existing);
    }

    const userIds = Array.from(byUser.keys());
    const allPrefs = await prisma.userNotificationPreference.findMany({
      where: { userId: { in: userIds }, subscriptionAudit: true },
    });
    const enabledUserIds = new Set(allPrefs.map((p) => p.userId));

    const notifier = TransactionNotifierFactory.getNotifier();

    for (const [userId, subs] of byUser) {
      try {
        if (!enabledUserIds.has(userId)) continue;

        const confirmed = subs.filter((s) => s.status === 'CONFIRMED');
        const detected = subs.filter((s) => s.status === 'DETECTED');

        if (confirmed.length === 0 && detected.length === 0) continue;

        const now = new Date();
        const monthName = now.toLocaleString('en-US', { month: 'long' });
        const year = now.getFullYear();

        const lines = [`Subscription Audit — ${monthName} ${year}`, ''];

        if (confirmed.length > 0) {
          lines.push('Active Subscriptions:');
          let totalMonthly = 0;
          let totalAnnual = 0;
          for (const sub of confirmed) {
            const monthly = toMonthlyAmount(sub.averageAmount, sub.frequency);
            totalMonthly += monthly;
            totalAnnual += sub.annualCost;
            lines.push(
              `- ${sub.displayName}: $${monthly.toFixed(2)}/mo ($${sub.annualCost.toFixed(2)}/yr)`,
            );
          }
          lines.push('');
          lines.push(
            `Total: $${totalMonthly.toFixed(2)}/month | $${totalAnnual.toFixed(2)}/year`,
          );
        }

        if (detected.length > 0) {
          lines.push(
            `${detected.length} new subscription${detected.length > 1 ? 's' : ''} detected — review in app`,
          );
        }

        await notifier.sendDailySummary(lines.join('\n'), userId);
      } catch (error) {
        logger.error(
          { err: error, userId },
          'Failed to send subscription audit for user',
        );
      }
    }
  }

  private async detectForUser(userId: string): Promise<void> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        status: 'APPROVED',
        date: { gte: twelveMonthsAgo },
      },
      orderBy: { date: 'asc' },
    });

    const groups = this.groupByMerchant(transactions);
    const dismissed =
      await subscriptionRepository.getDismissedMerchants(userId);
    const dismissedSet = new Set(
      dismissed.map((d) => `${d.merchantName}:${d.frequency}`),
    );

    for (const group of groups) {
      if (group.dates.length < 3) continue;

      const pattern = this.analyzePattern(group);
      if (!pattern) continue;

      if (dismissedSet.has(`${pattern.merchantKey}:${pattern.frequency}`)) {
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
      });
    }
  }

  private groupByMerchant(
    transactions: { description: string; value: number; date: Date }[],
  ): TransactionGroup[] {
    const groups = new Map<string, TransactionGroup>();

    for (const tx of transactions) {
      const key = normalizeMerchantName(tx.description);
      if (!key) continue;

      const existing = groups.get(key);
      if (existing) {
        existing.descriptions.push(tx.description);
        existing.amounts.push(tx.value);
        existing.dates.push(tx.date);
      } else {
        groups.set(key, {
          merchantKey: key,
          descriptions: [tx.description],
          amounts: [tx.value],
          dates: [tx.date],
        });
      }
    }

    return Array.from(groups.values());
  }

  private analyzePattern(group: TransactionGroup): DetectedPattern | null {
    const sortedDates = [...group.dates].sort(
      (a, b) => a.getTime() - b.getTime(),
    );

    const intervals: number[] = [];
    for (let i = 1; i < sortedDates.length; i++) {
      const diffDays =
        (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) /
        (1000 * 60 * 60 * 24);
      intervals.push(diffDays);
    }

    if (intervals.length === 0) return null;

    const sorted = [...intervals].sort((a, b) => a - b);
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

    const variance =
      intervals.reduce((sum, v) => sum + Math.pow(v - median, 2), 0) /
      intervals.length;
    const stddev = Math.sqrt(variance);

    const frequency = this.classifyFrequency(median);
    if (!frequency) return null;

    if (median > 0 && stddev / median > 0.3) return null;

    const confidence = Math.max(0, Math.min(1, 1 - stddev / median));
    const averageAmount =
      group.amounts.reduce((sum, a) => sum + a, 0) / group.amounts.length;
    const lastChargeDate = sortedDates[sortedDates.length - 1];
    const nextExpectedDate = this.calculateNextExpectedDate(
      lastChargeDate,
      frequency,
    );
    const annualCost = this.calculateAnnualCost(averageAmount, frequency);
    const displayName = this.pickDisplayName(group.descriptions);

    return {
      merchantKey: group.merchantKey,
      displayName,
      frequency,
      averageAmount: Math.round(averageAmount * 100) / 100,
      lastChargeDate,
      nextExpectedDate,
      annualCost: Math.round(annualCost * 100) / 100,
      descriptions: [...new Set(group.descriptions)],
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  private classifyFrequency(medianDays: number): SubscriptionFrequency | null {
    if (medianDays >= 5 && medianDays <= 9) return 'WEEKLY';
    if (medianDays >= 25 && medianDays <= 35) return 'MONTHLY';
    if (medianDays >= 340 && medianDays <= 395) return 'YEARLY';
    return null;
  }

  private calculateNextExpectedDate(
    lastDate: Date,
    frequency: SubscriptionFrequency,
  ): Date {
    switch (frequency) {
      case 'WEEKLY':
        return addWeeks(lastDate, 1);
      case 'MONTHLY':
        return addMonths(lastDate, 1);
      case 'YEARLY':
        return addYears(lastDate, 1);
    }
  }

  private calculateAnnualCost(
    amount: number,
    frequency: SubscriptionFrequency,
  ): number {
    switch (frequency) {
      case 'WEEKLY':
        return amount * 52;
      case 'MONTHLY':
        return amount * 12;
      case 'YEARLY':
        return amount;
    }
  }

  private pickDisplayName(descriptions: string[]): string {
    const descriptionCounts = new Map<string, number>();
    for (const desc of descriptions) {
      const trimmed = desc.trim();
      descriptionCounts.set(trimmed, (descriptionCounts.get(trimmed) || 0) + 1);
    }

    let mostCommon = descriptions[0];
    let maxCount = 0;
    for (const [desc, count] of descriptionCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = desc;
      }
    }

    return toDisplayName(mostCommon);
  }
}

export default new SubscriptionDetectionService();
