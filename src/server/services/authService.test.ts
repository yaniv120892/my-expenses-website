import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compare, hash } from 'bcryptjs';

const redis = vi.hoisted(() => ({
  setValue: vi.fn(),
  getValue: vi.fn(),
  takeValue: vi.fn(),
  deleteValue: vi.fn(),
  incrementWithTtl: vi.fn(),
}));

const users = vi.hoisted(() => ({
  findByEmailOrUsername: vi.fn(),
  findByEmail: vi.fn(),
  findById: vi.fn(),
  createUser: vi.fn(),
  verifyUser: vi.fn(),
  updatePassword: vi.fn(),
}));

const sessions = vi.hoisted(() => ({
  storeSession: vi.fn(),
  invalidateSession: vi.fn(),
  invalidateAllSessions: vi.fn(),
}));

const send = vi.hoisted(() => vi.fn());

vi.mock('@/server/redis', () => redis);
vi.mock('@/server/repositories/userRepository', () => ({ default: users }));
vi.mock('@/server/services/emailService', () => ({ default: { send } }));
vi.mock('@/server/services/announcementService', () => ({
  default: { acknowledgeAllForNewUser: vi.fn() },
}));
vi.mock('@/server/auth/session', () => sessions);
vi.mock('@/server/auth/tokens', () => ({
  signToken: vi.fn().mockResolvedValue('token'),
  tokenTtlSeconds: () => 60,
}));

import authService from '@/server/services/authService';

const EMAIL = 'user@example.com';
const PASSWORD = 'correct horse';

const store = new Map<string, unknown>();

function mailedCode(callIndex: number): string {
  const [mail] = send.mock.calls[callIndex] ?? [];
  const code = /Verification Code: (\d+)/.exec(mail?.text ?? '')?.[1];
  if (!code) {
    throw new Error(`no code in mail ${callIndex}`);
  }
  return code;
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
  redis.getValue.mockImplementation(async (key: string) => store.get(key) ?? null);
  redis.takeValue.mockImplementation(async (key: string) => {
    const value = store.get(key) ?? null;
    store.delete(key);
    return value;
  });
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

    await expect(authService.signupUser(EMAIL, 'someone')).rejects.toThrow('WEBSITE_URL');

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

    const result = await authService.verifyLoginCode(EMAIL, '000000', PASSWORD);

    expect(result).toEqual({
      error: 'Too many attempts. Please try again in 10 minutes.',
    });
    expect(redis.deleteValue).not.toHaveBeenCalledWith(`loginCode:${EMAIL}`);
  });

  it('still rejects a wrong code under the cap', async () => {
    store.set(`loginCode:${EMAIL}`, [{ code: '123456', expiresAt: Date.now() + 60_000 }]);

    expect(await authService.verifyLoginCode(EMAIL, '000000', PASSWORD)).toEqual({
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

    const result = await authService.signupUser(EMAIL, 'user');

    expect(result).toEqual({
      message: 'Verification code sent to email. Code is valid for 10 minutes.',
    });
    expect(redis.setValue).toHaveBeenCalledWith(
      `loginCode:${EMAIL}`,
      expect.any(Array),
      600,
      'branch',
    );
    // Anyone may sign up for a pending address, so a signup must not lift the
    // guess cap.
    expect(redis.deleteValue).not.toHaveBeenCalledWith(`loginCodeAttempts:${EMAIL}`, 'branch');
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
    expect(await authService.signupUser(EMAIL, 'user')).toEqual({
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

    expect(await authService.signupUser(EMAIL, 'user')).toEqual({
      error: 'User already exists',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('creates and mails a code for a new address', async () => {
    users.findByEmailOrUsername.mockResolvedValue(null);
    users.createUser.mockResolvedValue({ id: 'user-1' });

    await authService.signupUser(EMAIL, 'user');

    expect(users.createUser).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('creates the account with no usable password', async () => {
    users.findByEmailOrUsername.mockResolvedValue(null);
    users.createUser.mockResolvedValue({ id: 'user-1' });

    await authService.signupUser(EMAIL, 'user');

    const [, , storedPassword] = users.createUser.mock.calls[0] ?? [];
    expect(await compare(PASSWORD, storedPassword)).toBe(false);
  });
});

describe('signup squatting', () => {
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
    await authService.signupUser(EMAIL, 'squatter');
    await authService.signupUser(EMAIL, 'user');

    expect(send).toHaveBeenCalledTimes(2);
    expect(await authService.verifyLoginCode(EMAIL, mailedCode(1), PASSWORD)).toEqual({
      token: 'token',
      userId: 'user-1',
    });

    const [verifiedEmail, passwordHash] = users.verifyUser.mock.calls[0] ?? [];
    expect(verifiedEmail).toBe(EMAIL);
    expect(await compare(PASSWORD, passwordHash)).toBe(true);
  });

  it('keeps the owner’s code valid when a stranger signs up after them', async () => {
    await authService.signupUser(EMAIL, 'user');
    await authService.signupUser(EMAIL, 'squatter');

    expect(await authService.verifyLoginCode(EMAIL, mailedCode(0), PASSWORD)).toEqual({
      token: 'token',
      userId: 'user-1',
    });
    const [, passwordHash] = users.verifyUser.mock.calls[0] ?? [];
    expect(await compare(PASSWORD, passwordHash)).toBe(true);
  });

  it('sets the verifier’s password whichever live code they enter', async () => {
    await authService.signupUser(EMAIL, 'user');
    await authService.signupUser(EMAIL, 'squatter');

    await authService.verifyLoginCode(EMAIL, mailedCode(1), PASSWORD);

    const [, passwordHash] = users.verifyUser.mock.calls[0] ?? [];
    expect(await compare(PASSWORD, passwordHash)).toBe(true);
  });

  it('keeps only the three latest codes live for a pending address', async () => {
    await authService.signupUser(EMAIL, 'user');
    for (let attempt = 0; attempt < 3; attempt++) {
      await authService.signupUser(EMAIL, 'squatter');
    }

    expect(await authService.verifyLoginCode(EMAIL, mailedCode(0), PASSWORD)).toEqual({
      error: 'Invalid or expired code',
    });
    expect(await authService.verifyLoginCode(EMAIL, mailedCode(3), PASSWORD)).toEqual({
      token: 'token',
      userId: 'user-1',
    });
  });

  it('answers every signup for a pending address identically', async () => {
    const first = await authService.signupUser(EMAIL, 'a');
    const second = await authService.signupUser(EMAIL, 'b');

    expect(second).toEqual(first);
  });

  it('never lets a code reset a verified account’s password', async () => {
    await authService.signupUser(EMAIL, 'squatter');
    users.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: EMAIL,
      verified: true,
    });

    expect(await authService.verifyLoginCode(EMAIL, mailedCode(0), PASSWORD)).toEqual({
      error: 'Invalid or expired code',
    });
    expect(users.verifyUser).not.toHaveBeenCalled();
  });

  it('spends the code once verified', async () => {
    await authService.signupUser(EMAIL, 'user');
    await authService.verifyLoginCode(EMAIL, mailedCode(0), PASSWORD);

    expect(await authService.verifyLoginCode(EMAIL, mailedCode(0), PASSWORD)).toEqual({
      error: 'Invalid or expired code',
    });
  });
});

describe('a code stored while codes carried a signup’s password', () => {
  it('still verifies, and the password is the one the verifier names', async () => {
    store.set(`loginCode:${EMAIL}`, [
      {
        code: '123456',
        passwordHash: await hash('squatter password', 4),
        expiresAt: Date.now() + 60_000,
      },
    ]);
    users.findByEmail.mockResolvedValue({ id: 'user-1', email: EMAIL });

    expect(await authService.verifyLoginCode(EMAIL, '123456', PASSWORD)).toEqual({
      token: 'token',
      userId: 'user-1',
    });
    const [, passwordHash] = users.verifyUser.mock.calls[0] ?? [];
    expect(await compare(PASSWORD, passwordHash)).toBe(true);
  });
});

describe('verification email', () => {
  it('encodes the address in the verification link', async () => {
    users.findByEmailOrUsername.mockResolvedValue(null);
    users.createUser.mockResolvedValue({ id: 'user-1' });

    await authService.signupUser('a+tag@example.com', 'someone');

    const [{ text, html }] = send.mock.calls[0] ?? [];
    const link = 'https://expenses.example/verify?email=a%2Btag%40example.com';
    expect(text).toContain(link);
    expect(html).toContain(`href="${link}"`);
  });
});

describe('password reset', () => {
  const VERIFIED = { id: 'user-1', email: EMAIL, verified: true };

  it('mails nothing and stores nothing for an address with no verified account', async () => {
    users.findByEmail.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...VERIFIED,
      verified: false,
    });

    await authService.requestPasswordReset('nobody@example.com');
    await authService.requestPasswordReset(EMAIL);

    expect(send).not.toHaveBeenCalled();
    expect(redis.setValue).not.toHaveBeenCalled();
  });

  it('keeps the link alive for 30 minutes and stores only its hash', async () => {
    users.findByEmail.mockResolvedValue(VERIFIED);

    await authService.requestPasswordReset(EMAIL);

    const token = /#token=([\w-]+)/.exec(send.mock.calls[0]?.[0]?.text ?? '')?.[1] ?? '';
    expect(token.length).toBeGreaterThanOrEqual(43);
    const storedKeys = [...store.keys()].join(' ');
    expect(storedKeys).not.toContain(token);
    expect(redis.setValue).toHaveBeenCalledWith(
      expect.stringMatching(/^passwordReset:/),
      'user-1',
      1800,
      'branch',
    );
  });
});
