import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SessionModule from '@/server/auth/session';
import type * as NextServerModule from 'next/server';
import { NextRequest } from 'next/server';
import { installFakeCounterStore } from '@/test/fakeCounterStore';

const { requireUser, sendMonthlyReportForUser } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  sendMonthlyReportForUser: vi.fn(),
}));

vi.mock('@/server/auth/householdActor', async () =>
  (await import('@/test/memberActor')).householdActorWithTestMembers(),
);
vi.mock('@/server/auth/session', async () => ({
  ...(await vi.importActual<typeof SessionModule>('@/server/auth/session')),
  requireUser,
}));
vi.mock('@/server/services/monthlyReportService', () => ({
  default: { sendMonthlyReportForUser },
}));
vi.mock('@/server/observability', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  observability: { scheduleOpsAlert: vi.fn() },
}));
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof NextServerModule>('next/server')),
  after: vi.fn(),
}));

import { POST } from './route';
import { TEST_MONTHLY_REPORTS_PER_HOUR } from '@/server/costFences';

const counters = installFakeCounterStore();

const ROUTE_CONTEXT = { params: Promise.resolve(undefined) };

function sendTestReport(): Promise<Response> {
  return POST(
    new NextRequest('http://localhost/api/user/settings/test-monthly-report', {
      method: 'POST',
    }),
    ROUTE_CONTEXT,
  );
}

async function callRoute() {
  return (await sendTestReport()).json();
}

// The client words the notice in the user's language, so the route returns
// the outcome and the raw month rather than an English sentence.
describe('POST /api/user/settings/test-monthly-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ userId: 'user-1', tokenVersion: 0 });
  });

  it('returns the sent month and recipient', async () => {
    sendMonthlyReportForUser.mockResolvedValue({
      sent: true,
      monthLabel: 'September 2026',
      month: '2026-09',
      transactionCount: 0,
      recipient: 'user@example.com',
    });

    await expect(callRoute()).resolves.toEqual({
      status: 'SENT',
      month: '2026-09',
      recipient: 'user@example.com',
      transactionCount: 0,
    });
  });

  it('reports a report it could not build', async () => {
    sendMonthlyReportForUser.mockResolvedValue({
      sent: false,
      monthLabel: 'September 2026',
      month: '2026-09',
      transactionCount: 0,
      reason: 'NO_SETTINGS',
    });

    await expect(callRoute()).resolves.toEqual({ status: 'NOT_BUILT' });
  });

  it('reports a send that threw', async () => {
    sendMonthlyReportForUser.mockRejectedValue(new Error('smtp down'));

    await expect(callRoute()).resolves.toEqual({ status: 'FAILED' });
  });

  it('mails up to the hourly limit per user and refuses the next send without mailing', async () => {
    sendMonthlyReportForUser.mockResolvedValue({ sent: false, reason: 'NO_SETTINGS' });
    for (let sent = 0; sent < TEST_MONTHLY_REPORTS_PER_HOUR; sent += 1) {
      expect((await sendTestReport()).status).toBe(200);
    }
    sendMonthlyReportForUser.mockClear();

    const refused = await sendTestReport();

    expect(refused.status).toBe(429);
    await expect(refused.json()).resolves.toMatchObject({ code: 'RATE_LIMITED' });
    expect(sendMonthlyReportForUser).not.toHaveBeenCalled();
  });

  it('refuses without mailing when the counter store is down', async () => {
    counters.goDown();

    expect((await sendTestReport()).status).toBe(503);
    expect(sendMonthlyReportForUser).not.toHaveBeenCalled();
  });
});
