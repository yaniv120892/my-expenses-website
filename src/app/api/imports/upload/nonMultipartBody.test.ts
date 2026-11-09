import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SessionModule from '@/server/auth/session';
import { NextRequest } from 'next/server';

const { requireUser, loggerMock } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/server/auth/householdActor', async () =>
  (await import('@/test/memberActor')).householdActorWithTestMembers(),
);
vi.mock('@/server/auth/session', async () => ({
  ...(await vi.importActual<typeof SessionModule>('@/server/auth/session')),
  requireUser,
}));
vi.mock('@/server/observability', () => ({
  logger: loggerMock,
  observability: { scheduleOpsAlert: vi.fn() },
}));

import { POST } from '@/app/api/imports/upload/route';

const ROUTE_CONTEXT = { params: Promise.resolve(undefined) };

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ userId: 'user-1', tokenVersion: 0 });
});

describe('POST /api/imports/upload with a body that is not a form', () => {
  it('answers 400 naming the expected body, and reports no server error', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/imports/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file: 'statement.xlsx' }),
      }),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: 'Invalid multipart/form-data body' });
    expect(loggerMock.error).not.toHaveBeenCalled();
  });
});
