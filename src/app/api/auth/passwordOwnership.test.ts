import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compare, hash } from 'bcryptjs';
import crypto from 'crypto';
import type * as RateLimitModule from '@/server/http/rateLimit';
import type * as NextServerModule from 'next/server';
import { NextRequest } from 'next/server';

type StoredUser = {
  id: string;
  email: string;
  username: string;
  password: string;
  verified: boolean;
  householdId: string;
  householdRole: 'OWNER';
  tokenVersion: number;
};

const { store, users, send, enforceRateLimits, deleteAllApiTokens } = vi.hoisted(() => {
  vi.stubEnv('JWT_SECRET', 'password-ownership-test-secret');
  vi.stubEnv('WEBSITE_URL', 'https://expenses.example');
  return {
    store: new Map<string, unknown>(),
    users: new Map<string, StoredUser>(),
    send: vi.fn(),
    enforceRateLimits: vi.fn(),
    deleteAllApiTokens: vi.fn(),
  };
});

// JSON round trip, as the Redis client stores values.
vi.mock('@/server/redis', () => ({
  setValue: async (key: string, value: unknown) => {
    store.set(key, JSON.parse(JSON.stringify(value)));
  },
  getValue: async (key: string) => store.get(key) ?? null,
  takeValue: async (key: string) => {
    const value = store.get(key) ?? null;
    store.delete(key);
    return value;
  },
  deleteValue: async (key: string) => {
    store.delete(key);
  },
  deleteKeysWithPrefix: async (prefix: string) => {
    const matching = [...store.keys()].filter((key) => key.startsWith(prefix));
    matching.forEach((key) => store.delete(key));
    return matching.length;
  },
  incrementWithTtl: async (key: string) => {
    const count = Number(store.get(key) ?? 0) + 1;
    store.set(key, count);
    return count;
  },
}));

function memberOf(id: string) {
  return { id, householdId: `household-${id}`, householdRole: 'OWNER' as const, tokenVersion: 0 };
}

vi.mock('@/server/repositories/userRepository', () => {
  const byEmail = (email: string) => [...users.values()].find((user) => user.email === email);
  return {
    default: {
      findByEmailOrUsername: async (email: string, username: string) =>
        [...users.values()].find((user) => user.email === email || user.username === username) ??
        null,
      findByEmail: async (email: string) => byEmail(email) ?? null,
      findById: async (id: string) => users.get(id) ?? null,
      findMembership: async (id: string) => users.get(id) ?? null,
      createUser: async (email: string, username: string, password: string) => {
        const id = `user-${users.size + 1}`;
        const user = { ...memberOf(id), email, username, password, verified: false };
        users.set(user.id, user);
        return user;
      },
      verifyUser: async (email: string, password: string) => {
        const user = byEmail(email);
        if (!user) {
          throw new Error(`no user ${email}`);
        }
        Object.assign(user, { verified: true, password });
        return user;
      },
      updatePassword: async (id: string, password: string) => {
        const user = users.get(id);
        if (!user) {
          throw new Error(`no user ${id}`);
        }
        user.password = password;
      },
    },
  };
});

vi.mock('@/server/repositories/apiTokenRepository', () => ({
  apiTokenRepository: { deleteAllForUser: deleteAllApiTokens },
}));
vi.mock('@/server/services/emailService', () => ({ default: { send } }));
vi.mock('@/server/services/announcementService', () => ({
  default: { acknowledgeAllForNewUser: vi.fn() },
}));
vi.mock('@/server/http/rateLimit', async () => ({
  ...(await vi.importActual<typeof RateLimitModule>('@/server/http/rateLimit')),
  enforceRateLimits,
}));
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof NextServerModule>('next/server')),
  after: vi.fn(),
}));

import { POST as signup } from '@/app/api/auth/signup/route';
import { POST as verify } from '@/app/api/auth/verify/route';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as requestReset } from '@/app/api/auth/password-reset/request/route';
import { POST as confirmReset } from '@/app/api/auth/password-reset/confirm/route';
import { PUT as changePassword } from '@/app/api/auth/password/route';
import { GET as me } from '@/app/api/auth/me/route';
import userRepository from '@/server/repositories/userRepository';

const ROUTE_CONTEXT = { params: Promise.resolve(undefined) };
const OWNER_EMAIL = 'owner@example.com';
const OWNER_PASSWORD = 'owner password';
const STRANGER_PASSWORD = 'stranger password';
const NEW_PASSWORD = 'brand new password';

function request({
  method = 'POST',
  path,
  body,
  token,
}: {
  method?: 'POST' | 'PUT' | 'GET';
  path: string;
  body?: Record<string, unknown>;
  token?: string;
}): NextRequest {
  return new NextRequest(`https://expenses.example${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
}

function mailedText(index: number): string {
  const [mail] = send.mock.calls.at(index) ?? [];
  return mail?.text ?? '';
}

function mailedCode(index: number): string {
  const code = /Verification Code: (\d+)/.exec(mailedText(index))?.[1];
  if (!code) {
    throw new Error(`no code in mail ${index}`);
  }
  return code;
}

function mailedResetToken(index: number): string {
  const token = /reset-password#token=([\w-]+)/.exec(mailedText(index))?.[1];
  if (!token) {
    throw new Error(`no reset link in mail ${index}`);
  }
  return token;
}

function sessionKeys(): string[] {
  return [...store.keys()].filter((key) => key.startsWith('session:'));
}

function owner(): StoredUser {
  const found = [...users.values()].find((user) => user.email === OWNER_EMAIL);
  if (!found) {
    throw new Error('owner was never created');
  }
  return found;
}

async function seedVerifiedOwner(): Promise<void> {
  users.set('user-1', {
    ...memberOf('user-1'),
    email: OWNER_EMAIL,
    username: OWNER_EMAIL,
    password: await hash(OWNER_PASSWORD, 4),
    verified: true,
  });
}

async function logIn(password: string): Promise<string> {
  const response = await login(
    request({ path: '/api/auth/login', body: { email: OWNER_EMAIL, password } }),
    ROUTE_CONTEXT,
  );
  const { token } = await response.json();
  return token;
}

async function meStatus(token: string): Promise<number> {
  return (await me(request({ method: 'GET', path: '/api/auth/me', token }), ROUTE_CONTEXT)).status;
}

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  users.clear();
});

describe('signup for a pending address', () => {
  // Regression: each code carried the password of the signup that requested
  // it, so a stranger who re-signed-up for the owner's pending address set the
  // owner's password when the owner entered the newest code in their inbox.
  it('never lets a stranger’s signup choose the password the owner verifies into', async () => {
    await signup(
      request({ path: '/api/auth/signup', body: { email: OWNER_EMAIL, password: OWNER_PASSWORD } }),
      ROUTE_CONTEXT,
    );
    await signup(
      request({
        path: '/api/auth/signup',
        body: { email: OWNER_EMAIL, password: STRANGER_PASSWORD },
      }),
      ROUTE_CONTEXT,
    );

    const verified = await verify(
      request({
        path: '/api/auth/verify',
        body: { email: OWNER_EMAIL, code: mailedCode(-1), password: OWNER_PASSWORD },
      }),
      ROUTE_CONTEXT,
    );

    expect(verified.status).toBe(200);
    expect(await compare(OWNER_PASSWORD, owner().password)).toBe(true);
    expect(await compare(STRANGER_PASSWORD, owner().password)).toBe(false);
  });

  it('refuses a verification that names no password', async () => {
    await signup(
      request({ path: '/api/auth/signup', body: { email: OWNER_EMAIL } }),
      ROUTE_CONTEXT,
    );

    const verified = await verify(
      request({ path: '/api/auth/verify', body: { email: OWNER_EMAIL, code: mailedCode(0) } }),
      ROUTE_CONTEXT,
    );

    expect(verified.status).toBe(400);
    expect(owner().verified).toBe(false);
  });
});

describe('login racing a password reset', () => {
  // Regression: the reset swept sessions while the login was still comparing
  // the old password, so the session it stored afterwards survived the reset.
  it('stores no session when the password changed during the compare', async () => {
    await seedVerifiedOwner();
    vi.spyOn(userRepository, 'findByEmailOrUsername').mockImplementationOnce(async () => {
      const readBeforeReset = { ...owner() };
      owner().password = await hash(NEW_PASSWORD, 4);
      return readBeforeReset;
    });

    const response = await login(
      request({ path: '/api/auth/login', body: { email: OWNER_EMAIL, password: OWNER_PASSWORD } }),
      ROUTE_CONTEXT,
    );

    expect(response.status).not.toBe(200);
    expect(sessionKeys()).toEqual([]);
  });
});

describe('password reset', () => {
  it('answers an unknown address exactly as a registered one, mailing only the registered', async () => {
    await seedVerifiedOwner();

    const known = await requestReset(
      request({ path: '/api/auth/password-reset/request', body: { email: OWNER_EMAIL } }),
      ROUTE_CONTEXT,
    );
    const unknown = await requestReset(
      request({ path: '/api/auth/password-reset/request', body: { email: 'nobody@example.com' } }),
      ROUTE_CONTEXT,
    );

    expect(unknown.status).toBe(known.status);
    expect(await unknown.json()).toEqual(await known.json());
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sets the new password once, ends every session, and refuses the link a second time', async () => {
    await seedVerifiedOwner();
    const sessionBefore = await logIn(OWNER_PASSWORD);
    await requestReset(
      request({ path: '/api/auth/password-reset/request', body: { email: OWNER_EMAIL } }),
      ROUTE_CONTEXT,
    );
    const token = mailedResetToken(0);

    const reset = await confirmReset(
      request({
        path: '/api/auth/password-reset/confirm',
        body: { token, password: NEW_PASSWORD },
      }),
      ROUTE_CONTEXT,
    );
    const reused = await confirmReset(
      request({
        path: '/api/auth/password-reset/confirm',
        body: { token, password: STRANGER_PASSWORD },
      }),
      ROUTE_CONTEXT,
    );

    expect(reset.status).toBe(200);
    expect(reused.status).toBe(400);
    expect(await compare(NEW_PASSWORD, owner().password)).toBe(true);
    expect(await meStatus(sessionBefore)).toBe(401);
    expect(deleteAllApiTokens).toHaveBeenCalledWith(owner().id);
  });

  it('honours only the latest link mailed', async () => {
    await seedVerifiedOwner();
    for (let attempt = 0; attempt < 2; attempt++) {
      await requestReset(
        request({ path: '/api/auth/password-reset/request', body: { email: OWNER_EMAIL } }),
        ROUTE_CONTEXT,
      );
    }

    const stale = await confirmReset(
      request({
        path: '/api/auth/password-reset/confirm',
        body: { token: mailedResetToken(0), password: NEW_PASSWORD },
      }),
      ROUTE_CONTEXT,
    );

    expect(stale.status).toBe(400);
    expect(await compare(OWNER_PASSWORD, owner().password)).toBe(true);
  });

  // Two racing requests both revoke the same old link before writing their
  // own, so both links are stored; only the one the pointer names may work.
  it('refuses a stored link that a racing request superseded', async () => {
    await seedVerifiedOwner();
    for (let attempt = 0; attempt < 2; attempt++) {
      await requestReset(
        request({ path: '/api/auth/password-reset/request', body: { email: OWNER_EMAIL } }),
        ROUTE_CONTEXT,
      );
    }
    const superseded = mailedResetToken(0);
    const supersededHash = crypto.createHash('sha256').update(superseded).digest('hex');
    store.set(`passwordReset:${supersededHash}`, owner().id);

    const reset = await confirmReset(
      request({
        path: '/api/auth/password-reset/confirm',
        body: { token: superseded, password: STRANGER_PASSWORD },
      }),
      ROUTE_CONTEXT,
    );

    expect(reset.status).toBe(400);
    expect(await compare(OWNER_PASSWORD, owner().password)).toBe(true);
  });
});

describe('change password', () => {
  it('refuses a wrong current password and changes nothing', async () => {
    await seedVerifiedOwner();
    const session = await logIn(OWNER_PASSWORD);

    const changed = await changePassword(
      request({
        method: 'PUT',
        path: '/api/auth/password',
        token: session,
        body: { currentPassword: 'not it at all', newPassword: NEW_PASSWORD },
      }),
      ROUTE_CONTEXT,
    );

    expect(changed.status).toBe(400);
    expect(await compare(OWNER_PASSWORD, owner().password)).toBe(true);
    expect(await meStatus(session)).toBe(200);
  });

  it('ends every other session and keeps the caller signed in on a fresh one', async () => {
    await seedVerifiedOwner();
    const otherDevice = await logIn(OWNER_PASSWORD);
    const thisDevice = await logIn(OWNER_PASSWORD);

    const changed = await changePassword(
      request({
        method: 'PUT',
        path: '/api/auth/password',
        token: thisDevice,
        body: { currentPassword: OWNER_PASSWORD, newPassword: NEW_PASSWORD },
      }),
      ROUTE_CONTEXT,
    );
    const freshSession = /session=([^;]+)/.exec(changed.headers.get('set-cookie') ?? '')?.[1];

    expect(changed.status).toBe(200);
    expect(await compare(NEW_PASSWORD, owner().password)).toBe(true);
    expect(await meStatus(otherDevice)).toBe(401);
    expect(await meStatus(thisDevice)).toBe(401);
    expect(freshSession).toBeDefined();
    expect(await meStatus(freshSession ?? '')).toBe(200);
    expect((await changed.json()).token).toBe(freshSession);
    expect(deleteAllApiTokens).not.toHaveBeenCalled();
  });

  it('voids a reset link mailed before the change', async () => {
    await seedVerifiedOwner();
    const session = await logIn(OWNER_PASSWORD);
    await requestReset(
      request({ path: '/api/auth/password-reset/request', body: { email: OWNER_EMAIL } }),
      ROUTE_CONTEXT,
    );
    await changePassword(
      request({
        method: 'PUT',
        path: '/api/auth/password',
        token: session,
        body: { currentPassword: OWNER_PASSWORD, newPassword: NEW_PASSWORD },
      }),
      ROUTE_CONTEXT,
    );

    const reset = await confirmReset(
      request({
        path: '/api/auth/password-reset/confirm',
        body: { token: mailedResetToken(0), password: STRANGER_PASSWORD },
      }),
      ROUTE_CONTEXT,
    );

    expect(reset.status).toBe(400);
    expect(await compare(NEW_PASSWORD, owner().password)).toBe(true);
  });
});
