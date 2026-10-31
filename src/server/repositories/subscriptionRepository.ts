import type {
  SubscriptionStatus,
  SubscriptionFrequency,
  DetectedSubscription,
  Category,
  Prisma,
} from '@/generated/prisma/client';
import prisma from '@/server/db/client';
import type { HouseholdId } from '@/server/auth/householdActor.types';
import type {
  DetectedSubscriptionDomain,
  SubscriptionDashboardSnapshot,
  SubscriptionDetectionEvidence,
  UpdateSubscriptionInput,
} from '@/shared/types/subscription';
import { nextExpectedDateAfter, toMonthlyAmount } from '@/utils/subscriptionMath';

type DetectedSubscriptionRow = DetectedSubscription & {
  category?: Pick<Category, 'id' | 'name'> | null;
};

export type DetectionInput = {
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
};

export type UpdateSubscriptionFields = UpdateSubscriptionInput & {
  annualCost?: number;
};

type ExistingDetectionRow = {
  id: string;
  frequency: SubscriptionFrequency;
  status: SubscriptionStatus;
  userEditedAt: Date | null;
};

/** What buildAuditMessage needs; the evidence blob would dwarf it. */
export type SubscriptionAuditRow = {
  displayName: string;
  averageAmount: number;
  frequency: SubscriptionFrequency;
  annualCost: number;
  status: SubscriptionStatus;
};

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
  public async getByHousehold(
    householdId: HouseholdId,
    status?: SubscriptionStatus,
  ): Promise<DetectedSubscriptionDomain[]> {
    const subscriptions = await prisma.detectedSubscription.findMany({
      where: {
        householdId,
        ...(status ? { status } : {}),
      },
      include: withCategory,
      orderBy: { updatedAt: 'desc' },
    });
    return subscriptions.map(mapToDomain);
  }

  public async applyDetectionResults(
    householdId: HouseholdId,
    results: DetectionInput[],
  ): Promise<void> {
    if (results.length === 0) {
      return;
    }

    const existing = await prisma.detectedSubscription.findMany({
      where: { householdId },
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
      byMerchant.set(row.merchantName, [...(byMerchant.get(row.merchantName) ?? []), row]);
    }

    await Promise.all(
      results.map((result) =>
        this.applyDetection(householdId, result, byMerchant.get(result.merchantName) ?? []),
      ),
    );
  }

  /**
   * A merchant dismissed at this frequency stays untouched; a row the user
   * edited keeps its figures and frequency; anything else is fully refreshed.
   */
  private async applyDetection(
    householdId: HouseholdId,
    data: DetectionInput,
    existing: ExistingDetectionRow[],
  ): Promise<void> {
    const edited = existing.find((row) => row.userEditedAt);
    if (edited) {
      await prisma.detectedSubscription.update({
        where: { id: edited.id, householdId },
        data: {
          ...detectionOwnedFields(data),
          nextExpectedDate: nextExpectedDateAfter(data.lastChargeDate, edited.frequency),
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
        householdId_merchantName_frequency: {
          householdId,
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
        householdId,
        merchantName: data.merchantName,
        frequency: data.frequency,
        categoryId: data.categoryId,
      },
    });
  }

  public async update(
    householdId: HouseholdId,
    id: string,
    data: UpdateSubscriptionFields,
  ): Promise<DetectedSubscriptionDomain> {
    return this.applyUpdate(householdId, id, { ...data, userEditedAt: new Date() });
  }

  public async updateStatus(
    householdId: HouseholdId,
    id: string,
    status: SubscriptionStatus,
  ): Promise<DetectedSubscriptionDomain> {
    return this.applyUpdate(householdId, id, { status });
  }

  public async linkScheduledTransaction(
    householdId: HouseholdId,
    id: string,
    scheduledTransactionId: string,
  ): Promise<DetectedSubscriptionDomain> {
    return this.applyUpdate(householdId, id, {
      scheduledTransactionId,
      status: 'CONFIRMED',
    });
  }

  public async getById(
    householdId: HouseholdId,
    id: string,
  ): Promise<DetectedSubscriptionDomain | null> {
    const result = await prisma.detectedSubscription.findUnique({
      where: { id, householdId },
      include: withCategory,
    });
    return result ? mapToDomain(result) : null;
  }

  public async getSnapshot(householdId: HouseholdId): Promise<SubscriptionDashboardSnapshot> {
    const subscriptions = await prisma.detectedSubscription.findMany({
      where: {
        householdId,
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

  public async getActive(householdId: HouseholdId): Promise<SubscriptionAuditRow[]> {
    return prisma.detectedSubscription.findMany({
      where: {
        householdId,
        status: { in: ['DETECTED', 'CONFIRMED'] },
      },
      select: {
        displayName: true,
        averageAmount: true,
        frequency: true,
        annualCost: true,
        status: true,
      },
      orderBy: { displayName: 'asc' },
    });
  }

  private async applyUpdate(
    householdId: HouseholdId,
    id: string,
    data: Prisma.DetectedSubscriptionUpdateInput,
  ): Promise<DetectedSubscriptionDomain> {
    const result = await prisma.detectedSubscription.update({
      where: { id, householdId },
      data,
      include: withCategory,
    });
    return mapToDomain(result);
  }
}

// The column is written only from a SubscriptionDetectionEvidence, so a JSON
// object is that shape; null is a row detected before evidence was recorded.
function isDetectionEvidence(
  value: Prisma.JsonValue,
): value is Prisma.JsonObject & SubscriptionDetectionEvidence {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mapToDomain(db: DetectedSubscriptionRow): DetectedSubscriptionDomain {
  return {
    id: db.id,
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
    detectionEvidence: isDetectionEvidence(db.detectionEvidence) ? db.detectionEvidence : undefined,
    userEditedAt: db.userEditedAt ?? undefined,
    confidence: db.confidence,
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
  };
}

const subscriptionRepository = new SubscriptionRepository();
export default subscriptionRepository;
