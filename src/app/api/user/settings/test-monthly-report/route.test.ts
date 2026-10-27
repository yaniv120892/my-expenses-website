import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SessionModule from '@/server/auth/session';
import type * as NextServerModule from 'next/server';
import { NextRequest } from 'next/server';

const { requireUser, sendMonthlyReportForUser } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  sendMonthlyReportForUser: vi.fn(),
}));

vi.mock('@/server/auth/session', async () => ({
  ...(await vi.importActual<typeof SessionModule>('@/server/auth/session')),
  requireUser,
}));
vi.mock('@/server/services/monthlyReportService', () => ({
  default: { sendMonthlyReportForUser },
}));
vi.mock('@/server/logging/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/server/logging/betterStackStream', () => ({
  flushRemoteLogs: vi.fn(),
  betterStackStream: { write: vi.fn() },
}));
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof NextServerModule>('next/server')),
  after: vi.fn(),
}));

import { POST } from './route';

const ROUTE_CONTEXT = { params: Promise.resolve(undefined) };

async function callRoute() {
  const response = await POST(
    new NextRequest('http://localhost/api/user/settings/test-monthly-report', {
      method: 'POST',
    }),
    ROUTE_CONTEXT,
  );
  return response.json();
}

// The client words the notice in the user's language, so the route returns
// the outcome and the raw month rather than an English sentence.
describe('POST /api/user/settings/test-monthly-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue('user-1');
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
});
