import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { subRepo, prismaMock, sendDailySummary, scheduledService } = vi.hoisted(
  () => ({
    subRepo: {
      getActiveForAllUsers: vi.fn(),
      getByUserId: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
    },
    prismaMock: { userNotificationPreference: { findMany: vi.fn() } },
    sendDailySummary: vi.fn(),
    scheduledService: { listScheduledTransactions: vi.fn() },
  }),
);

vi.mock('@/server/repositories/subscriptionRepository', () => ({
  default: subRepo,
}));
vi.mock('@/server/db/client', () => ({ default: prismaMock }));
vi.mock('@/server/services/scheduledTransactionService', () => ({
  default: scheduledService,
}));
vi.mock(
  '@/server/services/transactionNotification/transactionNotifierFactory',
  () => ({
    default: { getNotifier: () => ({ sendDailySummary }) },
  }),
);

import subscriptionDetectionService from '@/server/services/subscriptionDetectionService';

type Sub = Record<string, unknown>;

const sub = (over: Sub = {}): Sub => ({
  id: 's1',
  userId: 'user-1',
  displayName: 'Netflix',
  averageAmount: 10,
  frequency: 'MONTHLY',
  annualCost: 120,
  status: 'CONFIRMED',
  ...over,
});

// The message header names the month it is sent in, so the clock is pinned
// rather than recomputed here — otherwise a run crossing midnight on the last
// of the month would disagree with the service.
const header = 'Subscription Audit — March 2026';

const enable = (...ids: string[]) =>
  prismaMock.userNotificationPreference.findMany.mockResolvedValue(
    ids.map((userId) => ({ userId })),
  );

const run = () => subscriptionDetectionService.sendMonthlyAuditNotifications();

// Intl currency output carries RTL marks and a non-breaking space; strip them
// so the expected strings stay readable.
const normalizeCurrency = (value: string) =>
  value.replace(/[\u200e\u200f]/g, '').replace(/\u00a0/g, ' ');

const messageFor = (userId: string) =>
  normalizeCurrency(
    sendDailySummary.mock.calls.find(
      (call) => call[1] === userId,
    )?.[0] as string,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));
  subRepo.getActiveForAllUsers.mockResolvedValue([]);
  subRepo.getByUserId.mockResolvedValue([]);
  subRepo.update.mockImplementation(
    async (id: string, _userId: string, data: Sub) => ({ id, ...data }),
  );
  scheduledService.listScheduledTransactions.mockResolvedValue([]);
  enable('user-1', 'user-2');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sendMonthlyAuditNotifications', () => {
  it('builds the confirmed block with per-sub and total figures', async () => {
    subRepo.getActiveForAllUsers.mockResolvedValue([sub()]);
    await run();
    expect(messageFor('user-1')).toBe(
      [
        header,
        '',
        'Active Subscriptions:',
        '- Netflix: 10.00 ₪/mo (120.00 ₪/yr)',
        '',
        'Total: 10.00 ₪/month | 120.00 ₪/year',
      ].join('\n'),
    );
  });

  it('converts weekly and yearly amounts to a monthly figure', async () => {
    subRepo.getActiveForAllUsers.mockResolvedValue([
      sub({ frequency: 'WEEKLY', averageAmount: 12, annualCost: 624 }),
      sub({
        id: 's2',
        frequency: 'YEARLY',
        averageAmount: 120,
        annualCost: 120,
      }),
    ]);
    await run();
    const message = messageFor('user-1');
    expect(message).toContain('- Netflix: 52.00 ₪/mo (624.00 ₪/yr)');
    expect(message).toContain('- Netflix: 10.00 ₪/mo (120.00 ₪/yr)');
    expect(message).toContain('Total: 62.00 ₪/month | 744.00 ₪/year');
  });

  it('skips users without the audit preference', async () => {
    subRepo.getActiveForAllUsers.mockResolvedValue([sub()]);
    enable('someone-else');
    await run();
    expect(sendDailySummary).not.toHaveBeenCalled();
  });

  it('skips users whose subs are neither confirmed nor detected', async () => {
    subRepo.getActiveForAllUsers.mockResolvedValue([
      sub({ status: 'CANCELLED' }),
    ]);
    await run();
    expect(sendDailySummary).not.toHaveBeenCalled();
  });

  it('detected-only omits the active block', async () => {
    subRepo.getActiveForAllUsers.mockResolvedValue([
      sub({ status: 'DETECTED' }),
    ]);
    await run();
    expect(sendDailySummary).toHaveBeenCalledWith(
      [header, '', '1 new subscription detected — review in app'].join('\n'),
      'user-1',
    );
  });

  it('pluralizes multiple detected subscriptions', async () => {
    subRepo.getActiveForAllUsers.mockResolvedValue([
      sub({ status: 'DETECTED' }),
      sub({ id: 's2', status: 'DETECTED' }),
    ]);
    await run();
    expect(sendDailySummary.mock.calls[0][0]).toContain(
      '2 new subscriptions detected',
    );
  });

  it('groups per user and queries prefs for every grouped id', async () => {
    subRepo.getActiveForAllUsers.mockResolvedValue([
      sub(),
      sub({ id: 's2', userId: 'user-2', displayName: 'Spotify' }),
    ]);
    await run();
    expect(prismaMock.userNotificationPreference.findMany).toHaveBeenCalledWith(
      {
        where: {
          userId: { in: ['user-1', 'user-2'] },
          subscriptionAudit: true,
        },
      },
    );
    expect(sendDailySummary).toHaveBeenCalledTimes(2);
    expect(sendDailySummary.mock.calls[1][1]).toBe('user-2');
  });

  it('one failing send does not stop the rest, but fails the run', async () => {
    subRepo.getActiveForAllUsers.mockResolvedValue([
      sub(),
      sub({ id: 's2', userId: 'user-2' }),
    ]);
    sendDailySummary.mockRejectedValueOnce(new Error('telegram down'));

    await expect(run()).rejects.toThrow(
      'Subscription audit failed for 1 of 2 user(s)',
    );
    expect(sendDailySummary).toHaveBeenCalledTimes(2);
  });

  it('an empty run sends nothing and does not throw', async () => {
    await expect(run()).resolves.toBeUndefined();
    expect(sendDailySummary).not.toHaveBeenCalled();
  });
});

const stored = (over: Sub = {}) => ({
  id: 'sub-1',
  userId: 'user-1',
  merchantName: 'netflix',
  displayName: 'Netflix',
  averageAmount: 50,
  frequency: 'MONTHLY',
  lastChargeDate: new Date('2026-03-04T00:00:00Z'),
  nextExpectedDate: new Date('2026-04-04T00:00:00Z'),
  annualCost: 600,
  monthlyCost: 50,
  status: 'CONFIRMED',
  matchingDescriptions: ['NETFLIX.COM'],
  confidence: 0.9,
  ...over,
});

const updateArgs = () => subRepo.update.mock.calls[0][2] as Sub;

describe('updateSubscription', () => {
  it('derives the annual cost from the new amount and frequency', async () => {
    subRepo.getById.mockResolvedValue(stored());
    await subscriptionDetectionService.updateSubscription('sub-1', 'user-1', {
      averageAmount: 30,
    });
    expect(updateArgs()).toMatchObject({
      averageAmount: 30,
      frequency: 'MONTHLY',
      annualCost: 360,
    });
  });

  it('moves the next expected date when the frequency changes', async () => {
    subRepo.getById.mockResolvedValue(stored());
    await subscriptionDetectionService.updateSubscription('sub-1', 'user-1', {
      frequency: 'YEARLY',
    });
    expect(updateArgs()).toMatchObject({
      frequency: 'YEARLY',
      annualCost: 50,
      nextExpectedDate: new Date('2027-03-04T00:00:00Z'),
    });
  });

  it('keeps the next expected date when only the amount changes', async () => {
    subRepo.getById.mockResolvedValue(stored());
    await subscriptionDetectionService.updateSubscription('sub-1', 'user-1', {
      averageAmount: 55,
    });
    expect(updateArgs().nextExpectedDate).toEqual(
      new Date('2026-04-04T00:00:00Z'),
    );
  });

  it('honours an explicitly given next expected date', async () => {
    subRepo.getById.mockResolvedValue(stored());
    await subscriptionDetectionService.updateSubscription('sub-1', 'user-1', {
      frequency: 'WEEKLY',
      nextExpectedDate: new Date('2026-05-01T00:00:00Z'),
    });
    expect(updateArgs().nextExpectedDate).toEqual(
      new Date('2026-05-01T00:00:00Z'),
    );
  });

  // undefined reaches Prisma as "leave alone"; null is what clears a field.
  it('leaves untouched fields undefined so Prisma skips them', async () => {
    subRepo.getById.mockResolvedValue(stored());
    await subscriptionDetectionService.updateSubscription('sub-1', 'user-1', {
      averageAmount: 30,
    });
    expect(updateArgs().displayName).toBeUndefined();
    expect(updateArgs().categoryId).toBeUndefined();
  });

  it('passes a cleared category through as null', async () => {
    subRepo.getById.mockResolvedValue(stored());
    await subscriptionDetectionService.updateSubscription('sub-1', 'user-1', {
      categoryId: null,
    });
    expect(updateArgs().categoryId).toBe(null);
  });

  it('rejects an unknown subscription', async () => {
    subRepo.getById.mockResolvedValue(null);
    await expect(
      subscriptionDetectionService.updateSubscription('nope', 'user-1', {
        averageAmount: 30,
      }),
    ).rejects.toThrow('Subscription not found');
  });

  it('explains a frequency clash instead of leaking the Prisma error', async () => {
    subRepo.getById.mockResolvedValue(stored());
    subRepo.update.mockRejectedValue(
      Object.assign(new Error('db'), { code: 'P2002' }),
    );
    await expect(
      subscriptionDetectionService.updateSubscription('sub-1', 'user-1', {
        frequency: 'WEEKLY',
      }),
    ).rejects.toThrow('Another subscription already tracks this merchant');
  });
});

describe('getSubscriptions', () => {
  it('totals only detected and confirmed rows', async () => {
    subRepo.getByUserId.mockResolvedValue([
      stored({
        id: 'a',
        status: 'CONFIRMED',
        monthlyCost: 50,
        annualCost: 600,
      }),
      stored({ id: 'b', status: 'DETECTED', monthlyCost: 10, annualCost: 120 }),
      stored({
        id: 'c',
        status: 'DISMISSED',
        monthlyCost: 99,
        annualCost: 999,
      }),
    ]);
    const result =
      await subscriptionDetectionService.getSubscriptions('user-1');
    expect(result).toMatchObject({
      activeCount: 1,
      detectedCount: 1,
      totalMonthlyEstimate: 60,
      totalAnnualEstimate: 720,
    });
  });

  it('flags a subscription an existing schedule already covers', async () => {
    subRepo.getByUserId.mockResolvedValue([stored()]);
    scheduledService.listScheduledTransactions.mockResolvedValue([
      {
        id: 'sched-1',
        description: 'Netflix monthly',
        value: 50,
        scheduleType: 'MONTHLY',
      },
    ]);
    const result =
      await subscriptionDetectionService.getSubscriptions('user-1');
    expect(result.subscriptions[0].scheduleMatch).toMatchObject({
      id: 'sched-1',
      matchType: 'NAME_MATCH',
    });
  });

  it('leaves scheduleMatch unset when nothing matches', async () => {
    subRepo.getByUserId.mockResolvedValue([stored()]);
    scheduledService.listScheduledTransactions.mockResolvedValue([
      {
        id: 'sched-1',
        description: 'Gym',
        value: 100,
        scheduleType: 'MONTHLY',
      },
    ]);
    const result =
      await subscriptionDetectionService.getSubscriptions('user-1');
    expect(result.subscriptions[0].scheduleMatch).toBeUndefined();
  });
});
