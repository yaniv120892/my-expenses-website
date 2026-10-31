import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DetectedSubscription, Prisma } from '@/generated/prisma/client';
import prisma from '@/server/db/client';
import subscriptionRepository from '@/server/repositories/subscriptionRepository';
import { toHouseholdId } from '@/server/auth/householdId';

vi.mock('@/server/db/client', () => ({
  default: {
    detectedSubscription: {
      findUnique: vi.fn(),
    },
  },
}));

const findUniqueMock = vi.mocked(prisma.detectedSubscription.findUnique);

const evidence = {
  analyzedFrom: '2026-01-01',
  analyzedTo: '2026-06-30',
  chargeCount: 6,
};

function storedRow(detectionEvidence: Prisma.JsonValue): DetectedSubscription & { category: null } {
  return {
    id: 'sub-1',
    userId: 'user-1',
    householdId: 'household-1',
    merchantName: 'NETFLIX',
    displayName: 'Netflix',
    averageAmount: 50,
    frequency: 'MONTHLY',
    lastChargeDate: new Date('2026-06-01'),
    nextExpectedDate: new Date('2026-07-01'),
    annualCost: 600,
    status: 'DETECTED',
    matchingDescriptions: ['NETFLIX'],
    scheduledTransactionId: null,
    categoryId: null,
    category: null,
    detectionEvidence,
    userEditedAt: null,
    confidence: 0.9,
    createdAt: new Date('2026-06-01'),
    updatedAt: new Date('2026-06-01'),
  };
}

describe('subscriptionRepository detection evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns stored evidence', async () => {
    findUniqueMock.mockResolvedValueOnce(storedRow(evidence));

    const subscription = await subscriptionRepository.getById(
      toHouseholdId('household-1'),
      'sub-1',
    );

    expect(subscription?.detectionEvidence).toEqual(evidence);
  });

  it('reports no evidence for a row detected before it was recorded', async () => {
    findUniqueMock.mockResolvedValueOnce(storedRow(null));

    const subscription = await subscriptionRepository.getById(
      toHouseholdId('household-1'),
      'sub-1',
    );

    expect(subscription?.detectionEvidence).toBeUndefined();
  });

  it('reports no evidence when the column holds something other than an object', async () => {
    findUniqueMock.mockResolvedValueOnce(storedRow(['not', 'evidence']));

    const subscription = await subscriptionRepository.getById(
      toHouseholdId('household-1'),
      'sub-1',
    );

    expect(subscription?.detectionEvidence).toBeUndefined();
  });
});
