import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { subRepo, prismaMock, sendDailySummary } = vi.hoisted(() => ({
  subRepo: { getActiveForAllUsers: vi.fn() },
  prismaMock: { userNotificationPreference: { findMany: vi.fn() } },
  sendDailySummary: vi.fn(),
}));

vi.mock('@/server/repositories/subscriptionRepository', () => ({
  default: subRepo,
}));
vi.mock('@/server/db/client', () => ({ default: prismaMock }));
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));
  subRepo.getActiveForAllUsers.mockResolvedValue([]);
  enable('user-1', 'user-2');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sendMonthlyAuditNotifications', () => {
  it('builds the confirmed block with per-sub and total figures', async () => {
    subRepo.getActiveForAllUsers.mockResolvedValue([sub()]);
    await run();
    expect(sendDailySummary).toHaveBeenCalledWith(
      [
        header,
        '',
        'Active Subscriptions:',
        '- Netflix: $10.00/mo ($120.00/yr)',
        '',
        'Total: $10.00/month | $120.00/year',
      ].join('\n'),
      'user-1',
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
    const message = sendDailySummary.mock.calls[0][0] as string;
    expect(message).toContain('- Netflix: $52.00/mo ($624.00/yr)');
    expect(message).toContain('- Netflix: $10.00/mo ($120.00/yr)');
    expect(message).toContain('Total: $62.00/month | $744.00/year');
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
