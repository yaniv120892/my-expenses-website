import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SessionModule from '@/server/auth/session';
import type * as NextServerModule from 'next/server';
import { NextRequest } from 'next/server';

const { requireUser, userRepository, telegramService } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  userRepository: {
    getUserSettings: vi.fn(),
    findTelegramProvider: vi.fn(),
    updateNotificationPreferences: vi.fn(),
    setTelegramChat: vi.fn(),
  },
  telegramService: { sendMessage: vi.fn() },
}));

vi.mock('@/server/auth/session', async () => ({
  ...(await vi.importActual<typeof SessionModule>('@/server/auth/session')),
  requireUser,
}));
vi.mock('@/server/repositories/userRepository', () => ({
  default: userRepository,
}));
vi.mock('@/server/services/telegramService', () => ({ telegramService }));
vi.mock('@/server/redis', () => ({
  incrementManyWithTtl: vi.fn(async (rules: unknown[]) => rules.map(() => 1)),
}));
vi.mock('@/server/observability', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof NextServerModule>('next/server')),
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

type StoredProvider = { enabled: boolean; data: object };

function useStoredProvider(provider: StoredProvider | null) {
  const row = provider && { provider: 'TELEGRAM', ...provider };
  userRepository.getUserSettings.mockResolvedValue({
    info: { email: 'a@example.com' },
    notifications: NOTIFICATIONS,
    providers: row ? [row] : [],
  });
  userRepository.findTelegramProvider.mockResolvedValue(row);
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
  useStoredProvider({ enabled: true, data: { chatId: LINKED_CHAT_ID } });
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
    expect(userRepository.updateNotificationPreferences).toHaveBeenCalledExactlyOnceWith({
      userId: 'user-1',
      notifications: NOTIFICATIONS,
    });
    expect(userRepository.setTelegramChat).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      info: { email: 'a@example.com' },
      notifications: NOTIFICATIONS,
      provider: { telegramLinked: true },
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
    expect(body.provider).toEqual({ telegramLinked: true });
    expect(JSON.stringify(body)).not.toContain(LINKED_CHAT_ID);
  });

  it('reports no link when no chat is bound', async () => {
    useStoredProvider(null);

    const response = await GET(
      new NextRequest('http://localhost/api/user/settings'),
      ROUTE_CONTEXT,
    );

    expect((await response.json()).provider).toEqual({
      telegramLinked: false,
    });
  });

  it('reports a disabled row as unlinked, matching what the senders use', async () => {
    useStoredProvider({ enabled: false, data: { chatId: LINKED_CHAT_ID } });

    const response = await GET(
      new NextRequest('http://localhost/api/user/settings'),
      ROUTE_CONTEXT,
    );

    expect((await response.json()).provider).toEqual({
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
    useStoredProvider(null);

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
