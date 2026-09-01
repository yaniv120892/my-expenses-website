import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hash } from 'bcryptjs';

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
  isSessionActive: vi.fn(),
}));
vi.mock('@/server/auth/tokens', () => ({
  signToken: vi.fn().mockResolvedValue('token'),
  tokenTtlSeconds: () => 60,
  verifyToken: vi.fn(),
}));

import authService from '@/server/services/authService';

const EMAIL = 'user@example.com';
const PASSWORD = 'correct horse';

beforeEach(() => {
  vi.clearAllMocks();
  // The verification email links back to the site, so signup cannot run
  // without an origin to build that link from.
  vi.stubEnv('WEBSITE_URL', 'https://expenses.example');
  redis.incrementWithTtl.mockResolvedValue(1);
  redis.getValue.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('signupUser without a configured origin', () => {
  // Regression: the origin used to be resolved while rendering the email, so
  // signup created the user and stored the code, then threw — and the retry
  // path threw at the same point, leaving the address permanently unverifiable.
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
  // Regression: the cap deleted the code, and /api/auth/verify is public with
  // no resend behind it — so six posts against a known pending signup left
  // that account permanently unverifiable.
  it('locks out past the cap without destroying the code', async () => {
    redis.incrementWithTtl.mockResolvedValue(6);

    const result = await authService.verifyLoginCode(EMAIL, '000000');

    expect(result).toEqual({
      error: 'Too many attempts. Please request a new code.',
    });
    expect(redis.deleteValue).not.toHaveBeenCalledWith(`loginCode:${EMAIL}`);
  });

  it('still rejects a wrong code under the cap', async () => {
    redis.getValue.mockResolvedValue('123456');

    expect(await authService.verifyLoginCode(EMAIL, '000000')).toEqual({
      error: 'Invalid or expired code',
    });
  });
});

describe('signupUser', () => {
  it('re-sends the code when an unverified account retries with its password', async () => {
    users.findByEmailOrUsername.mockResolvedValue({
      email: EMAIL,
      verified: false,
      password: await hash(PASSWORD, 10),
    });

    const result = await authService.signupUser(EMAIL, 'user', PASSWORD);

    expect(result).toEqual({
      message: 'Verification code sent to email. Code is valid for 10 minutes.',
    });
    expect(redis.setValue).toHaveBeenCalledWith(
      `loginCode:${EMAIL}`,
      expect.any(String),
      600,
    );
    // The lockout has to lift too, or the fresh code is unusable.
    expect(redis.deleteValue).toHaveBeenCalledWith(
      `loginCodeAttempts:${EMAIL}`,
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(users.createUser).not.toHaveBeenCalled();
  });

  it('does not mail a code to an unverified account on a wrong password', async () => {
    users.findByEmailOrUsername.mockResolvedValue({
      email: EMAIL,
      verified: false,
      password: await hash(PASSWORD, 10),
    });

    // Same answer as the right password, or this public endpoint would let
    // anyone guess a pending account's password.
    expect(await authService.signupUser(EMAIL, 'user', 'guess')).toEqual({
      message: 'Verification code sent to email. Code is valid for 10 minutes.',
    });
    expect(send).not.toHaveBeenCalled();
    expect(redis.setValue).not.toHaveBeenCalled();
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
});
