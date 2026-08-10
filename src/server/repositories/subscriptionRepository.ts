import {
  SubscriptionStatus,
  SubscriptionFrequency,
  DetectedSubscription,
} from '@prisma/client';
import prisma from '@/server/db/client';
import {
  DetectedSubscriptionDomain,
  SubscriptionDashboardSnapshot,
} from '@/shared/types/subscription';
import { toMonthlyAmount } from '@/server/utils/subscriptionMath';

class SubscriptionRepository {
  public async getByUserId(
    userId: string,
    status?: SubscriptionStatus,
  ): Promise<DetectedSubscriptionDomain[]> {
    const subscriptions = await prisma.detectedSubscription.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
    return subscriptions.map(this.mapToDomain);
  }

  public async upsert(data: {
    userId: string;
    merchantName: string;
    displayName: string;
    averageAmount: number;
    frequency: SubscriptionFrequency;
    lastChargeDate: Date;
    nextExpectedDate: Date;
    annualCost: number;
    matchingDescriptions: string[];
    confidence: number;
  }): Promise<DetectedSubscriptionDomain> {
    const result = await prisma.detectedSubscription.upsert({
      where: {
        userId_merchantName_frequency: {
          userId: data.userId,
          merchantName: data.merchantName,
          frequency: data.frequency,
        },
      },
      update: {
        displayName: data.displayName,
        averageAmount: data.averageAmount,
        lastChargeDate: data.lastChargeDate,
        nextExpectedDate: data.nextExpectedDate,
        annualCost: data.annualCost,
        matchingDescriptions: data.matchingDescriptions,
        confidence: data.confidence,
      },
      create: {
        userId: data.userId,
        merchantName: data.merchantName,
        displayName: data.displayName,
        averageAmount: data.averageAmount,
        frequency: data.frequency,
        lastChargeDate: data.lastChargeDate,
        nextExpectedDate: data.nextExpectedDate,
        annualCost: data.annualCost,
        matchingDescriptions: data.matchingDescriptions,
        confidence: data.confidence,
      },
    });
    return this.mapToDomain(result);
  }

  public async updateStatus(
    id: string,
    userId: string,
    status: SubscriptionStatus,
  ): Promise<DetectedSubscriptionDomain> {
    const result = await prisma.detectedSubscription.update({
      where: { id, userId },
      data: { status },
    });
    return this.mapToDomain(result);
  }

  public async linkScheduledTransaction(
    id: string,
    userId: string,
    scheduledTransactionId: string,
  ): Promise<DetectedSubscriptionDomain> {
    const result = await prisma.detectedSubscription.update({
      where: { id, userId },
      data: { scheduledTransactionId, status: 'CONFIRMED' },
    });
    return this.mapToDomain(result);
  }

  public async getById(
    id: string,
    userId: string,
  ): Promise<DetectedSubscriptionDomain | null> {
    const result = await prisma.detectedSubscription.findUnique({
      where: { id, userId },
    });
    return result ? this.mapToDomain(result) : null;
  }

  public async getDismissedMerchants(
    userId: string,
  ): Promise<{ merchantName: string; frequency: SubscriptionFrequency }[]> {
    const dismissed = await prisma.detectedSubscription.findMany({
      where: { userId, status: 'DISMISSED' },
      select: { merchantName: true, frequency: true },
    });
    return dismissed;
  }

  public async getAllUserIds(): Promise<string[]> {
    const users = await prisma.user.findMany({
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  public async getSnapshotByUserId(
    userId: string,
  ): Promise<SubscriptionDashboardSnapshot> {
    const subscriptions = await prisma.detectedSubscription.findMany({
      where: {
        userId,
        status: { in: ['CONFIRMED', 'DETECTED'] },
      },
      select: {
        status: true,
        averageAmount: true,
        annualCost: true,
        frequency: true,
      },
    });

    let activeCount = 0;
    let detectedCount = 0;
    let totalMonthlyEstimate = 0;
    let totalAnnualEstimate = 0;

    for (const s of subscriptions) {
      totalMonthlyEstimate += toMonthlyAmount(s.averageAmount, s.frequency);
      totalAnnualEstimate += s.annualCost;

      if (s.status === 'CONFIRMED') activeCount++;
      else detectedCount++;
    }

    return {
      activeCount,
      totalMonthlyEstimate,
      totalAnnualEstimate,
      detectedCount,
    };
  }

  public async getActiveForAllUsers(): Promise<DetectedSubscriptionDomain[]> {
    const subscriptions = await prisma.detectedSubscription.findMany({
      where: {
        status: { in: ['DETECTED', 'CONFIRMED'] },
      },
      orderBy: { userId: 'asc' },
    });
    return subscriptions.map(this.mapToDomain);
  }

  private mapToDomain(db: DetectedSubscription): DetectedSubscriptionDomain {
    return {
      id: db.id,
      userId: db.userId,
      merchantName: db.merchantName,
      displayName: db.displayName,
      averageAmount: db.averageAmount,
      frequency: db.frequency,
      lastChargeDate: db.lastChargeDate,
      nextExpectedDate: db.nextExpectedDate,
      annualCost: db.annualCost,
      status: db.status,
      matchingDescriptions: db.matchingDescriptions,
      scheduledTransactionId: db.scheduledTransactionId ?? undefined,
      confidence: db.confidence,
      createdAt: db.createdAt,
      updatedAt: db.updatedAt,
    };
  }
}

export default new SubscriptionRepository();
