import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { requireUser, userRepository, telegramService } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  userRepository: {
    getUserSettings: vi.fn(),
    updateNotificationPreferences: vi.fn(),
    setTelegramChat: vi.fn(),
  },
  telegramService: { sendMessage: vi.fn() },
}));

vi.mock('@/server/auth/session', async () => ({
  ...(await vi.importActual<typeof import('@/server/auth/session')>(
    '@/server/auth/session',
  )),
  requireUser,
}));
vi.mock('@/server/repositories/userRepository', () => ({
  default: userRepository,
}));
vi.mock('@/server/services/telegramService', () => ({ telegramService }));
vi.mock('@/server/redis', () => ({
  incrementManyWithTtl: vi.fn(async (rules: unknown[]) => rules.map(() => 1)),
}));
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

import { GET, PUT } from '@/app/api/user/settings/route';
import { POST as testTelegram } from '@/app/api/user/settings/test-telegram/route';

const ROUTE_CONTEXT = { params: Promise.resolve(undefined) };
const LINKED_CHAT_ID = '1001';
const NOTIFICATIONS = {
  createTransaction: true,
  dailySummary: false,
  subscriptionAudit: false,
  monthlyReport: true,
};

function storedSettings(provider: { enabled: boolean; data: object } | null) {
  return {
    info: { email: 'a@example.com' },
    notifications: NOTIFICATIONS,
    providers: provider ? [{ provider: 'TELEGRAM', ...provider }] : [],
  };
}

function jsonRequest(path: string, method: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue('user-1');
  userRepository.getUserSettings.mockResolvedValue(
    storedSettings({ enabled: true, data: { chatId: LINKED_CHAT_ID } }),
  );
});

describe('PUT /api/user/settings', () => {
  it('saves the notification toggles and ignores a client-supplied chat id', async () => {
    const response = await PUT(
      jsonRequest('/api/user/settings', 'PUT', {
        info: { email: 'a@example.com' },
        notifications: NOTIFICATIONS,
        provider: { enabled: true, telegramChatId: '-100999' },
      }),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(200);
    expect(
      userRepository.updateNotificationPreferences,
    ).toHaveBeenCalledExactlyOnceWith('user-1', NOTIFICATIONS);
    expect(userRepository.setTelegramChat).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      info: { email: 'a@example.com' },
      notifications: NOTIFICATIONS,
      provider: { enabled: true, telegramLinked: true },
    });
  });
});

describe('GET /api/user/settings', () => {
  it('reports an already-linked chat as linked without exposing its id', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/user/settings'),
      ROUTE_CONTEXT,
    );

    const body = await response.json();
    expect(body.provider).toEqual({ enabled: true, telegramLinked: true });
    expect(JSON.stringify(body)).not.toContain(LINKED_CHAT_ID);
  });

  it('reports no link when no chat is bound', async () => {
    userRepository.getUserSettings.mockResolvedValue(storedSettings(null));

    const response = await GET(
      new NextRequest('http://localhost/api/user/settings'),
      ROUTE_CONTEXT,
    );

    expect((await response.json()).provider).toEqual({
      enabled: false,
      telegramLinked: false,
    });
  });
});

describe('POST /api/user/settings/test-telegram', () => {
  it('sends to the linked chat, never to one named in the request', async () => {
    const response = await testTelegram(
      jsonRequest('/api/user/settings/test-telegram', 'POST', {
        chatId: '-100999',
      }),
      ROUTE_CONTEXT,
    );

    expect((await response.json()).success).toBe(true);
    expect(telegramService.sendMessage).toHaveBeenCalledExactlyOnceWith(
      LINKED_CHAT_ID,
      expect.any(String),
    );
  });

  it('sends nothing when no chat is linked', async () => {
    userRepository.getUserSettings.mockResolvedValue(storedSettings(null));

    const response = await testTelegram(
      jsonRequest('/api/user/settings/test-telegram', 'POST', {
        chatId: '-100999',
      }),
      ROUTE_CONTEXT,
    );

    expect(await response.json()).toEqual({
      success: false,
      message: 'No Telegram chat is linked. Link one first.',
    });
    expect(telegramService.sendMessage).not.toHaveBeenCalled();
  });
});
