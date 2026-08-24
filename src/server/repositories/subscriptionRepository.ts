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
  UpdateSubscriptionInput,
} from '@/shared/types/subscription';
import {
  nextExpectedDateAfter,
  toMonthlyAmount,
} from '@/utils/subscriptionMath';

type DetectedSubscriptionRow = DetectedSubscription & {
  category?: Pick<Category, 'id' | 'name'> | null;
};

export interface DetectionInput {
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

export type UpdateSubscriptionFields = UpdateSubscriptionInput & {
  annualCost?: number;
};

interface ExistingDetectionRow {
  id: string;
  frequency: SubscriptionFrequency;
  status: SubscriptionStatus;
  userEditedAt: Date | null;
}

/** What buildAuditMessage needs; the evidence blob would dwarf it. */
export interface SubscriptionAuditRow {
  userId: string;
  displayName: string;
  averageAmount: number;
  frequency: SubscriptionFrequency;
  annualCost: number;
  status: SubscriptionStatus;
}

const withCategory = {
  category: { select: { id: true, name: true } },
} satisfies Prisma.DetectedSubscriptionInclude;

// The charges and confidence a detection run may refresh even on a row whose
// figures the user has taken ownership of.
function detectionOwnedFields(data: DetectionInput) {
  return {
    lastChargeDate: data.lastChargeDate,
    matchingDescriptions: data.matchingDescriptions,
    confidence: data.confidence,
    detectionEvidence: data.detectionEvidence,
  };
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

  /**
   * Writes a whole detection run for one user. Reads the rows it may collide
   * with once, then applies each merchant independently.
   */
  public async applyDetectionResults(
    userId: string,
    results: DetectionInput[],
  ): Promise<void> {
    if (results.length === 0) {
      return;
    }

    const existing = await prisma.detectedSubscription.findMany({
      where: { userId },
      select: {
        id: true,
        merchantName: true,
        frequency: true,
        status: true,
        userEditedAt: true,
      },
    });

    const byMerchant = new Map<string, typeof existing>();
    for (const row of existing) {
      byMerchant.set(row.merchantName, [
        ...(byMerchant.get(row.merchantName) ?? []),
        row,
      ]);
    }

    await Promise.all(
      results.map((result) =>
        this.applyDetection(result, byMerchant.get(result.merchantName) ?? []),
      ),
    );
  }

  /**
   * Decides what a detection run is allowed to touch: a merchant the user
   * dismissed at this frequency stays untouched, a row whose figures the user
   * edited keeps them along with its own frequency, and anything else is
   * fully refreshed.
   */
  private async applyDetection(
    data: DetectionInput,
    existing: ExistingDetectionRow[],
  ): Promise<void> {
    const edited = existing.find((row) => row.userEditedAt);
    if (edited) {
      await prisma.detectedSubscription.update({
        where: { id: edited.id },
        data: {
          ...detectionOwnedFields(data),
          nextExpectedDate: nextExpectedDateAfter(
            data.lastChargeDate,
            edited.frequency,
          ),
        },
      });
      return;
    }

    const dismissed = existing.some(
      (row) => row.status === 'DISMISSED' && row.frequency === data.frequency,
    );
    if (dismissed) {
      return;
    }

    const fields = {
      ...detectionOwnedFields(data),
      displayName: data.displayName,
      averageAmount: data.averageAmount,
      nextExpectedDate: data.nextExpectedDate,
      annualCost: data.annualCost,
    };

    await prisma.detectedSubscription.upsert({
      where: {
        userId_merchantName_frequency: {
          userId: data.userId,
          merchantName: data.merchantName,
          frequency: data.frequency,
        },
      },
      // A row the user never categorized adopts the detected category, but a
      // category they chose is theirs even without a full edit.
      update: {
        ...fields,
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
      },
      create: {
        ...fields,
        userId: data.userId,
        merchantName: data.merchantName,
        frequency: data.frequency,
        categoryId: data.categoryId,
      },
    });
  }

  public async update(
    id: string,
    userId: string,
    data: UpdateSubscriptionFields,
  ): Promise<DetectedSubscriptionDomain> {
    return this.applyUpdate(id, userId, { ...data, userEditedAt: new Date() });
  }

  public async updateStatus(
    id: string,
    userId: string,
    status: SubscriptionStatus,
  ): Promise<DetectedSubscriptionDomain> {
    return this.applyUpdate(id, userId, { status });
  }

  public async linkScheduledTransaction(
    id: string,
    userId: string,
    scheduledTransactionId: string,
  ): Promise<DetectedSubscriptionDomain> {
    return this.applyUpdate(id, userId, {
      scheduledTransactionId,
      status: 'CONFIRMED',
    });
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

      if (s.status === 'CONFIRMED') {
        activeCount++;
      } else {
        detectedCount++;
      }
    }

    return {
      activeCount,
      totalMonthlyEstimate,
      totalAnnualEstimate,
      detectedCount,
    };
  }

  public async getActiveForAllUsers(): Promise<SubscriptionAuditRow[]> {
    return prisma.detectedSubscription.findMany({
      where: {
        status: { in: ['DETECTED', 'CONFIRMED'] },
      },
      select: {
        userId: true,
        displayName: true,
        averageAmount: true,
        frequency: true,
        annualCost: true,
        status: true,
      },
      orderBy: { userId: 'asc' },
    });
  }

  private async applyUpdate(
    id: string,
    userId: string,
    data: Prisma.DetectedSubscriptionUpdateInput,
  ): Promise<DetectedSubscriptionDomain> {
    const result = await prisma.detectedSubscription.update({
      where: { id, userId },
      data,
      include: withCategory,
    });
    return mapToDomain(result);
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
