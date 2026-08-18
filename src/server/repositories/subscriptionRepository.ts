import {
  SubscriptionStatus,
  SubscriptionFrequency,
  DetectedSubscription,
  Category,
  Prisma,
} from '@prisma/client';
import prisma from '@/server/db/client';
import {
  DetectedSubscriptionDomain,
  SubscriptionDashboardSnapshot,
  SubscriptionDetectionEvidence,
} from '@/shared/types/subscription';
import { toMonthlyAmount } from '@/server/utils/subscriptionMath';

type DetectedSubscriptionRow = DetectedSubscription & {
  category?: Pick<Category, 'id' | 'name'> | null;
};

export interface UpsertDetectionInput {
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
  categoryId?: string;
  detectionEvidence: SubscriptionDetectionEvidence;
}

/** The fields re-detection may refresh on a subscription the user has edited. */
export interface RefreshDetectionInput {
  lastChargeDate: Date;
  nextExpectedDate: Date;
  matchingDescriptions: string[];
  confidence: number;
  detectionEvidence: SubscriptionDetectionEvidence;
}

export interface UpdateSubscriptionFields {
  displayName?: string;
  averageAmount?: number;
  frequency?: SubscriptionFrequency;
  lastChargeDate?: Date;
  nextExpectedDate?: Date;
  annualCost?: number;
  categoryId?: string | null;
}

const withCategory = {
  category: { select: { id: true, name: true } },
} satisfies Prisma.DetectedSubscriptionInclude;

function toJson(
  evidence: SubscriptionDetectionEvidence,
): Prisma.InputJsonValue {
  return evidence as unknown as Prisma.InputJsonValue;
}

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
      include: withCategory,
      orderBy: { updatedAt: 'desc' },
    });
    return subscriptions.map(mapToDomain);
  }

  public async upsert(
    data: UpsertDetectionInput,
  ): Promise<DetectedSubscriptionDomain> {
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
        detectionEvidence: toJson(data.detectionEvidence),
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
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
        categoryId: data.categoryId,
        detectionEvidence: toJson(data.detectionEvidence),
      },
      include: withCategory,
    });
    return mapToDomain(result);
  }

  public async refreshDetection(
    id: string,
    data: RefreshDetectionInput,
  ): Promise<DetectedSubscriptionDomain> {
    const result = await prisma.detectedSubscription.update({
      where: { id },
      data: {
        lastChargeDate: data.lastChargeDate,
        nextExpectedDate: data.nextExpectedDate,
        matchingDescriptions: data.matchingDescriptions,
        confidence: data.confidence,
        detectionEvidence: toJson(data.detectionEvidence),
      },
      include: withCategory,
    });
    return mapToDomain(result);
  }

  public async update(
    id: string,
    userId: string,
    data: UpdateSubscriptionFields,
  ): Promise<DetectedSubscriptionDomain> {
    const result = await prisma.detectedSubscription.update({
      where: { id, userId },
      data: { ...data, userEditedAt: new Date() },
      include: withCategory,
    });
    return mapToDomain(result);
  }

  public async updateStatus(
    id: string,
    userId: string,
    status: SubscriptionStatus,
  ): Promise<DetectedSubscriptionDomain> {
    const result = await prisma.detectedSubscription.update({
      where: { id, userId },
      data: { status },
      include: withCategory,
    });
    return mapToDomain(result);
  }

  public async linkScheduledTransaction(
    id: string,
    userId: string,
    scheduledTransactionId: string,
  ): Promise<DetectedSubscriptionDomain> {
    const result = await prisma.detectedSubscription.update({
      where: { id, userId },
      data: { scheduledTransactionId, status: 'CONFIRMED' },
      include: withCategory,
    });
    return mapToDomain(result);
  }

  public async getById(
    id: string,
    userId: string,
  ): Promise<DetectedSubscriptionDomain | null> {
    const result = await prisma.detectedSubscription.findUnique({
      where: { id, userId },
      include: withCategory,
    });
    return result ? mapToDomain(result) : null;
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
      include: withCategory,
      orderBy: { userId: 'asc' },
    });
    return subscriptions.map(mapToDomain);
  }
}

function mapToDomain(db: DetectedSubscriptionRow): DetectedSubscriptionDomain {
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
    monthlyCost: toMonthlyAmount(db.averageAmount, db.frequency),
    status: db.status,
    matchingDescriptions: db.matchingDescriptions,
    scheduledTransactionId: db.scheduledTransactionId ?? undefined,
    categoryId: db.categoryId ?? undefined,
    categoryName: db.category?.name ?? undefined,
    detectionEvidence:
      (db.detectionEvidence as SubscriptionDetectionEvidence | null) ??
      undefined,
    userEditedAt: db.userEditedAt ?? undefined,
    confidence: db.confidence,
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
  };
}

export default new SubscriptionRepository();
