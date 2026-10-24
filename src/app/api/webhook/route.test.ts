import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { requireUser, redisStore, userRepository, telegramService } = vi.hoisted(
  () => ({
    requireUser: vi.fn(),
    redisStore: new Map<string, { value: unknown; ttlSeconds: number }>(),
    userRepository: { setTelegramChat: vi.fn() },
    telegramService: { sendPlainMessage: vi.fn() },
  }),
);

vi.mock('@/server/auth/session', async () => ({
  ...(await vi.importActual<typeof import('@/server/auth/session')>(
    '@/server/auth/session',
  )),
  requireUser,
}));
vi.mock('@/server/redis', () => ({
  setValue: vi.fn(async (key: string, value: unknown, ttlSeconds: number) => {
    redisStore.set(key, { value, ttlSeconds });
  }),
  takeValue: vi.fn(async (key: string) => {
    const entry = redisStore.get(key);
    redisStore.delete(key);
    return entry?.value ?? null;
  }),
  incrementManyWithTtl: vi.fn(async (rules: unknown[]) => rules.map(() => 1)),
}));
vi.mock('@/server/repositories/userRepository', () => ({
  default: userRepository,
}));
vi.mock('@/server/services/telegramService', () => ({ telegramService }));
vi.mock('@/server/logging/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/server/logging/betterStackStream', () => ({
  flushRemoteLogs: vi.fn(),
  betterStackStream: { write: vi.fn() },
}));
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof import('next/server')>('next/server')),
  after: vi.fn(),
}));

import { POST as telegramWebhook } from '@/app/api/webhook/route';
import { POST as issueLinkCode } from '@/app/api/user/settings/telegram-link/route';

const ROUTE_CONTEXT = { params: Promise.resolve(undefined) };
const WEBHOOK_SECRET = 'telegram-secret';
const USER_ID = 'user-1';
const CHAT_ID = 424242;

function sendToBot(text: string, chatId: number = CHAT_ID) {
  return telegramWebhook(
    new NextRequest('http://localhost/api/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        update_id: 1,
        message: { message_id: 1, chat: { id: chatId, type: 'private' }, text },
      }),
    }),
    ROUTE_CONTEXT,
  );
}

async function requestLinkCode() {
  const response = await issueLinkCode(
    new NextRequest('http://localhost/api/user/settings/telegram-link', {
      method: 'POST',
    }),
    ROUTE_CONTEXT,
  );
  expect(response.status).toBe(200);
  return response.json();
}

beforeEach(() => {
  vi.clearAllMocks();
  redisStore.clear();
  vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', WEBHOOK_SECRET);
  vi.stubEnv('TELEGRAM_BOT_USERNAME', '');
  requireUser.mockResolvedValue(USER_ID);
});

describe('linking a Telegram chat with a one-time /start code', () => {
  it('issues a short-lived code bound to the signed-in user', async () => {
    const issued = await requestLinkCode();

    expect(issued.command).toBe(`/start ${issued.code}`);
    expect(issued.deepLink).toBeNull();
    expect(redisStore.get(`telegramLinkCode:${issued.code}`)).toEqual({
      value: USER_ID,
      ttlSeconds: 600,
    });
  });

  it('offers a deep link when the bot username is configured', async () => {
    vi.stubEnv('TELEGRAM_BOT_USERNAME', '@MyExpensesBot');

    const issued = await requestLinkCode();

    expect(issued.deepLink).toBe(
      `https://t.me/MyExpensesBot?start=${issued.code}`,
    );
  });

  it('binds the chat the code arrives from to the user who issued it', async () => {
    const { code } = await requestLinkCode();

    const response = await sendToBot(`/start ${code}`);

    expect(response.status).toBe(200);
    expect(userRepository.setTelegramChat).toHaveBeenCalledExactlyOnceWith(
      USER_ID,
      String(CHAT_ID),
    );
    expect(telegramService.sendPlainMessage).toHaveBeenCalledWith(
      String(CHAT_ID),
      expect.stringContaining('now linked'),
    );
  });

  it('refuses a code that was already used, binding nothing the second time', async () => {
    const { code } = await requestLinkCode();
    await sendToBot(`/start ${code}`);
    userRepository.setTelegramChat.mockClear();

    const response = await sendToBot(`/start ${code}`, 999);

    expect(response.status).toBe(200);
    expect(userRepository.setTelegramChat).not.toHaveBeenCalled();
    expect(telegramService.sendPlainMessage).toHaveBeenLastCalledWith(
      '999',
      expect.stringContaining('invalid or has expired'),
    );
  });

  it('binds nothing for a code that was never issued', async () => {
    const response = await sendToBot('/start not-a-real-code');

    expect(response.status).toBe(200);
    expect(userRepository.setTelegramChat).not.toHaveBeenCalled();
  });

  it('ignores other messages and updates without a message', async () => {
    await sendToBot('hello');
    const editResponse = await telegramWebhook(
      new NextRequest('http://localhost/api/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telegram-bot-api-secret-token': WEBHOOK_SECRET,
        },
        body: JSON.stringify({ update_id: 2, edited_message: { text: 'x' } }),
      }),
      ROUTE_CONTEXT,
    );

    expect(editResponse.status).toBe(200);
    expect(userRepository.setTelegramChat).not.toHaveBeenCalled();
    expect(telegramService.sendPlainMessage).not.toHaveBeenCalled();
  });

  it('keeps the link and answers 200 when the reply cannot be sent', async () => {
    const { code } = await requestLinkCode();
    telegramService.sendPlainMessage.mockRejectedValue(new Error('blocked'));

    const response = await sendToBot(`/start ${code}`);

    expect(response.status).toBe(200);
    expect(userRepository.setTelegramChat).toHaveBeenCalledOnce();
  });

  it('rejects an update without the webhook secret', async () => {
    const response = await telegramWebhook(
      new NextRequest('http://localhost/api/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: { chat: { id: CHAT_ID }, text: '/start anything' },
        }),
      }),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(401);
    expect(userRepository.setTelegramChat).not.toHaveBeenCalled();
  });
});
