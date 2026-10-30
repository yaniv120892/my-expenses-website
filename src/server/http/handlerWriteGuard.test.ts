import type * as HouseholdActorModule from '@/server/auth/householdActor';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SessionModule from '@/server/auth/session';
import type * as NextServerModule from 'next/server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { HouseholdRole } from '@/generated/prisma/enums';

const { requireUser, resolveMemberActor } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  resolveMemberActor: vi.fn(),
}));

vi.mock('@/server/auth/householdActor', async () => ({
  ...(await vi.importActual<typeof HouseholdActorModule>('@/server/auth/householdActor')),
  resolveMemberActor,
}));
vi.mock('@/server/auth/session', async () => ({
  ...(await vi.importActual<typeof SessionModule>('@/server/auth/session')),
  requireUser,
}));
vi.mock('@/server/observability', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof NextServerModule>('next/server')),
  after: vi.fn(),
}));

import { createHandler } from '@/server/http/handler';
import { testMemberActor } from '@/test/memberActor';

const ROUTE_CONTEXT = { params: Promise.resolve({}) };
const USER_ID = '11111111-1111-4111-8111-111111111111';

function request(method: string): NextRequest {
  return new NextRequest('http://localhost/api/transactions', {
    method,
    headers: { cookie: 'session=browser-jwt' },
  });
}

function signInAs(role: HouseholdRole): void {
  requireUser.mockResolvedValue({ userId: USER_ID, tokenVersion: 0 });
  resolveMemberActor.mockResolvedValue(testMemberActor({ userId: USER_ID, role }));
}

const handler = vi.fn(async () => ({ ok: true }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the central write guard', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    "refuses a viewer's %s on a household route before the handler runs",
    async (method) => {
      signInAs('VIEWER');
      const route = createHandler({ auth: 'session', handler });

      const response = await route(request(method), ROUTE_CONTEXT);

      expect(response.status).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it("refuses a viewer's write before its body is validated or rate-limited", async () => {
    signInAs('VIEWER');
    const rateLimit = vi.fn(() => []);
    const route = createHandler({
      auth: 'session',
      bodySchema: z.object({ amount: z.number() }),
      rateLimit,
      handler,
    });

    const response = await route(request('POST'), ROUTE_CONTEXT);

    expect(response.status).toBe(403);
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it.each([
    ['VIEWER', 'GET', undefined],
    ['VIEWER', 'POST', 'ownAccount'],
    ['VIEWER', 'POST', 'perOperation'],
    ['OWNER', 'POST', undefined],
    ['EDITOR', 'POST', undefined],
  ] as const)('lets a %s %s a route declaring writes=%s', async (role, method, writes) => {
    signInAs(role);
    const route = createHandler({ auth: 'session', writes, handler });

    const response = await route(request(method), ROUTE_CONTEXT);

    expect(response.status).toBe(200);
  });

  it('hands the handler the member it resolved', async () => {
    signInAs('EDITOR');
    const route = createHandler({
      auth: 'session',
      handler: async ({ actor }) => ({ householdId: actor.householdId, role: actor.role }),
    });

    const response = await route(request('GET'), ROUTE_CONTEXT);

    expect(await response.json()).toEqual({
      householdId: `household-of-${USER_ID}`,
      role: 'EDITOR',
    });
  });
});
