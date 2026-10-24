import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compare, hash } from 'bcryptjs';

const redis = vi.hoisted(() => ({
  setValue: vi.fn(),
  getValue: vi.fn(),
  deleteValue: vi.fn(),
  incrementWithTtl: vi.fn(),
}));

const users = vi.hoisted(() => ({
  findByEmailOrUsername: vi.fn(),
  findByEmail: vi.fn(),
  createUser: vi.fn(),
  verifyUser: vi.fn(),
}));

const send = vi.hoisted(() => vi.fn());

vi.mock('@/server/redis', () => redis);
vi.mock('@/server/repositories/userRepository', () => ({ default: users }));
vi.mock('@/server/services/emailService', () => ({ default: { send } }));
vi.mock('@/server/services/announcementService', () => ({
  default: { acknowledgeAllForNewUser: vi.fn() },
}));
vi.mock('@/server/auth/session', () => ({
  storeSession: vi.fn(),
  invalidateSession: vi.fn(),
}));
vi.mock('@/server/auth/tokens', () => ({
  signToken: vi.fn().mockResolvedValue('token'),
  tokenTtlSeconds: () => 60,
}));

import authService from '@/server/services/authService';

const EMAIL = 'user@example.com';
const PASSWORD = 'correct horse';

const store = new Map<string, unknown>();

function mailedCode(callIndex: number): string {
  const match = /Verification Code: (\d+)/.exec(
    send.mock.calls[callIndex][0].text,
  );
  if (!match) {
    throw new Error(`no code in mail ${callIndex}`);
  }
  return match[1];
}

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  vi.stubEnv('WEBSITE_URL', 'https://expenses.example');
  redis.incrementWithTtl.mockResolvedValue(1);
  // JSON round trip, as the Redis client stores values.
  redis.setValue.mockImplementation(async (key: string, value: unknown) => {
    store.set(key, JSON.parse(JSON.stringify(value)));
  });
  redis.getValue.mockImplementation(
    async (key: string) => store.get(key) ?? null,
  );
  redis.deleteValue.mockImplementation(async (key: string) => {
    store.delete(key);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('signupUser without a configured origin', () => {
  // Regression: the origin was resolved after the user was created, leaving the
  // address permanently unverifiable.
  it('fails before writing anything', async () => {
    vi.stubEnv('WEBSITE_URL', undefined);
    vi.stubEnv('VERCEL_BRANCH_URL', undefined);
    vi.stubEnv('VERCEL_URL', undefined);
    users.findByEmailOrUsername.mockResolvedValue(null);

    await expect(
      authService.signupUser(EMAIL, 'someone', PASSWORD),
    ).rejects.toThrow('WEBSITE_URL');

    expect(users.findByEmailOrUsername).not.toHaveBeenCalled();
    expect(users.createUser).not.toHaveBeenCalled();
    expect(redis.setValue).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('verifyLoginCode', () => {
  // Regression: the cap deleted the code, and with no resend a public endpoint
  // could strand a pending signup.
  it('locks out past the cap without destroying the code', async () => {
    redis.incrementWithTtl.mockResolvedValue(6);

    const result = await authService.verifyLoginCode(EMAIL, '000000');

    expect(result).toEqual({
      error: 'Too many attempts. Please request a new code.',
    });
    expect(redis.deleteValue).not.toHaveBeenCalledWith(`loginCode:${EMAIL}`);
  });

  it('still rejects a wrong code under the cap', async () => {
    store.set(`loginCode:${EMAIL}`, '123456');

    expect(await authService.verifyLoginCode(EMAIL, '000000')).toEqual({
      error: 'Invalid or expired code',
    });
  });
});

describe('signupUser', () => {
  it('re-sends the code when an unverified account retries', async () => {
    users.findByEmailOrUsername.mockResolvedValue({
      email: EMAIL,
      verified: false,
      password: await hash('unusable', 10),
    });

    const result = await authService.signupUser(EMAIL, 'user', PASSWORD);

    expect(result).toEqual({
      message: 'Verification code sent to email. Code is valid for 10 minutes.',
    });
    expect(redis.setValue).toHaveBeenCalledWith(
      `loginCode:${EMAIL}`,
      expect.any(Array),
      600,
      'branch',
    );
    // The lockout has to lift too, or the fresh code is unusable.
    expect(redis.deleteValue).toHaveBeenCalledWith(
      `loginCodeAttempts:${EMAIL}`,
      'branch',
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(users.createUser).not.toHaveBeenCalled();
  });

  it('refuses a username taken by someone else’s pending account', async () => {
    users.findByEmailOrUsername.mockResolvedValue({
      email: 'someone-else@e2e.test',
      verified: false,
      password: await hash(PASSWORD, 10),
    });

    // Masking this as "code sent" would strand the new user: no code would
    // ever arrive for an address that has no account.
    expect(await authService.signupUser(EMAIL, 'user', PASSWORD)).toEqual({
      error: 'User already exists',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses a verified account even with the right password', async () => {
    users.findByEmailOrUsername.mockResolvedValue({
      email: EMAIL,
      verified: true,
      password: await hash(PASSWORD, 10),
    });

    expect(await authService.signupUser(EMAIL, 'user', PASSWORD)).toEqual({
      error: 'User already exists',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('creates and mails a code for a new address', async () => {
    users.findByEmailOrUsername.mockResolvedValue(null);
    users.createUser.mockResolvedValue({ id: 'user-1' });

    await authService.signupUser(EMAIL, 'user', PASSWORD);

    expect(users.createUser).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('never stores the signup password on the unverified account', async () => {
    users.findByEmailOrUsername.mockResolvedValue(null);
    users.createUser.mockResolvedValue({ id: 'user-1' });

    await authService.signupUser(EMAIL, 'user', PASSWORD);

    const [, , storedPassword] = users.createUser.mock.calls[0];
    expect(await compare(PASSWORD, storedPassword)).toBe(false);
  });
});

describe('signup squatting', () => {
  const SQUATTER_PASSWORD = 'squatter password';

  beforeEach(() => {
    users.findByEmailOrUsername.mockResolvedValueOnce(null).mockResolvedValue({
      email: EMAIL,
      verified: false,
      password: 'unusable',
    });
    users.createUser.mockResolvedValue({ id: 'user-1' });
    users.findByEmail.mockResolvedValue({ id: 'user-1', email: EMAIL });
  });

  // Regression: the first signup fixed the account's password, and the real
  // owner's retry with their own password was answered but mailed nothing.
  it('lets the address owner verify with their own password after a stranger signed up first', async () => {
    await authService.signupUser(EMAIL, 'squatter', SQUATTER_PASSWORD);
    await authService.signupUser(EMAIL, 'user', PASSWORD);

    expect(send).toHaveBeenCalledTimes(2);
    expect(await authService.verifyLoginCode(EMAIL, mailedCode(1))).toEqual({
      token: 'token',
    });

    const [verifiedEmail, passwordHash] = users.verifyUser.mock.calls[0];
    expect(verifiedEmail).toBe(EMAIL);
    expect(await compare(PASSWORD, passwordHash)).toBe(true);
  });

  it('keeps the owner’s code valid when a stranger signs up after them', async () => {
    await authService.signupUser(EMAIL, 'user', PASSWORD);
    await authService.signupUser(EMAIL, 'squatter', SQUATTER_PASSWORD);

    expect(await authService.verifyLoginCode(EMAIL, mailedCode(0))).toEqual({
      token: 'token',
    });
    const [, passwordHash] = users.verifyUser.mock.calls[0];
    expect(await compare(PASSWORD, passwordHash)).toBe(true);
    expect(await compare(SQUATTER_PASSWORD, passwordHash)).toBe(false);
  });

  it('answers every signup for a pending address identically', async () => {
    const first = await authService.signupUser(EMAIL, 'a', SQUATTER_PASSWORD);
    const second = await authService.signupUser(EMAIL, 'b', PASSWORD);

    expect(second).toEqual(first);
  });

  it('spends the code once verified', async () => {
    await authService.signupUser(EMAIL, 'user', PASSWORD);
    await authService.verifyLoginCode(EMAIL, mailedCode(0));

    expect(await authService.verifyLoginCode(EMAIL, mailedCode(0))).toEqual({
      error: 'Invalid or expired code',
    });
  });
});

describe('a code issued before codes carried a password', () => {
  it('still verifies and leaves the stored password alone', async () => {
    store.set(`loginCode:${EMAIL}`, 123456);
    users.findByEmail.mockResolvedValue({ id: 'user-1', email: EMAIL });

    expect(await authService.verifyLoginCode(EMAIL, '123456')).toEqual({
      token: 'token',
    });
    expect(users.verifyUser).toHaveBeenCalledWith(EMAIL, null);
  });
});

describe('verification email', () => {
  it('encodes the address in the verification link', async () => {
    users.findByEmailOrUsername.mockResolvedValue(null);
    users.createUser.mockResolvedValue({ id: 'user-1' });

    await authService.signupUser('a+tag@example.com', 'someone', PASSWORD);

    const [{ text, html }] = send.mock.calls[0];
    const link = 'https://expenses.example/verify?email=a%2Btag%40example.com';
    expect(text).toContain(link);
    expect(html).toContain(`href="${link}"`);
  });
});
