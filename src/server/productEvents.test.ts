import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type * as SessionModule from '@/server/auth/session';
import type * as RateLimitModule from '@/server/http/rateLimit';
import type * as NextServerModule from 'next/server';
import { NextRequest } from 'next/server';

const {
  authService,
  transactionService,
  importService,
  chatService,
  categoryRepository,
  requireUser,
  enforceRateLimits,
  requestCookies,
  fetchMock,
} = vi.hoisted(() => {
  vi.stubEnv('POSTHOG_PROJECT_KEY', 'phc_test');
  // The package sends product events from production only.
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('JWT_SECRET', 'product-events-test-secret');
  // The analytics client takes the global fetch when it is built, at import.
  const fetchMock = vi.fn(async (..._: Parameters<typeof fetch>) => new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    authService: { loginUser: vi.fn(), verifyLoginCode: vi.fn() },
    transactionService: {
      createTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      deleteTransaction: vi.fn(),
      getTransactionItem: vi.fn(),
    },
    importService: { processImport: vi.fn() },
    chatService: { streamChatResponse: vi.fn() },
    categoryRepository: { getAllCategories: vi.fn() },
    requireUser: vi.fn(),
    enforceRateLimits: vi.fn(),
    requestCookies: new Map<string, string>(),
  };
});

vi.mock('@/server/services/authService', () => ({ default: authService }));
vi.mock('@/server/services/transactionService', () => ({ default: transactionService }));
vi.mock('@/server/services/importService', () => ({ importService }));
vi.mock('@/server/services/chatService', () => ({ default: chatService }));
vi.mock('@/server/repositories/categoryRepository', () => ({ default: categoryRepository }));
vi.mock('@/server/auth/session', async () => ({
  ...(await vi.importActual<typeof SessionModule>('@/server/auth/session')),
  requireUser,
}));
vi.mock('@/server/http/rateLimit', async () => ({
  ...(await vi.importActual<typeof RateLimitModule>('@/server/http/rateLimit')),
  enforceRateLimits,
}));
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof NextServerModule>('next/server')),
  after: vi.fn(),
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = requestCookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

import { observability } from '@/server/observability';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as verify } from '@/app/api/auth/verify/route';
import { POST as createTransaction } from '@/app/api/transactions/route';
import {
  DELETE as deleteTransaction,
  PUT as updateTransaction,
} from '@/app/api/transactions/[id]/route';
import { POST as processImport } from '@/app/api/imports/process/route';
import { POST as chat } from '@/app/api/chat/route';
import { createMcpServer } from '@/server/mcp/createMcpServer';
import { signToken } from '@/server/auth/tokens';
import { SESSION_COOKIE } from '@/server/auth/cookies';
import TransactionsLayout from '@/app/(app)/transactions/layout';
import DashboardLayout from '@/app/(app)/dashboard/layout';
import PendingLayout from '@/app/(app)/pending/layout';
import ScheduledLayout from '@/app/(app)/scheduled/layout';
import SubscriptionsLayout from '@/app/(app)/subscriptions/layout';
import ImportsLayout from '@/app/(app)/imports/layout';
import TrendsLayout from '@/app/(app)/trends/layout';
import SettingsLayout from '@/app/(app)/settings/layout';

type SentEvent = {
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
};

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TRANSACTION_ID = '33333333-3333-4333-8333-333333333333';
const POSTHOG_BATCH_URL = 'https://eu.i.posthog.com/batch/';
const ROUTE_CONTEXT = { params: Promise.resolve(undefined) };
const ID_CONTEXT = { params: Promise.resolve({ id: TRANSACTION_ID }) };
const AGENT_TRANSACTION = {
  id: TRANSACTION_ID,
  description: 'Coffee',
  value: 18,
  currency: 'ILS',
  originalAmount: 18,
  exchangeRate: null,
  exchangeRateDate: null,
  exchangeRateSource: null,
  date: new Date('2026-10-20T00:00:00Z'),
  type: 'EXPENSE',
  status: 'APPROVED',
  category: { id: 'c-food', name: 'Food' },
};

function jsonRequest({
  path,
  method = 'POST',
  body,
}: {
  path: string;
  method?: string;
  body?: unknown;
}): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

async function sentEvents(): Promise<SentEvent[]> {
  await observability.flushRemoteLogs();
  return fetchMock.mock.calls
    .filter(([url]) => String(url) === POSTHOG_BATCH_URL)
    .flatMap(([, init]) => {
      const { batch }: { batch: SentEvent[] } = JSON.parse(String(init?.body));
      return batch;
    });
}

async function connectAgent(): Promise<Client> {
  const server = createMcpServer({ userId: USER_ID });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-agent', version: '1.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

beforeEach(async () => {
  await observability.flushRemoteLogs();
  vi.clearAllMocks();
  requestCookies.clear();
  requireUser.mockResolvedValue(USER_ID);
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('product events', () => {
  it('names the person by app and internal user id, and labels the app and environment', async () => {
    authService.loginUser.mockResolvedValue({ token: 'jwt', userId: USER_ID });

    await login(
      jsonRequest({
        path: '/api/auth/login',
        body: { email: 'someone@example.com', username: 'someone', password: 'secret-password' },
      }),
      ROUTE_CONTEXT,
    );

    expect(await sentEvents()).toEqual([
      {
        event: 'logged_in',
        distinct_id: `my-expenses-website:${USER_ID}`,
        timestamp: expect.any(String),
        properties: { app: 'my-expenses-website', environment: 'production' },
      },
    ]);
  });

  it('records nothing for a failed login', async () => {
    authService.loginUser.mockResolvedValue({ error: 'Invalid credentials' });

    await login(
      jsonRequest({
        path: '/api/auth/login',
        body: { email: 'someone@example.com', username: 'someone', password: 'wrong-password' },
      }),
      ROUTE_CONTEXT,
    );

    expect(await sentEvents()).toEqual([]);
  });

  it('records a sign-up when the emailed code verifies the account', async () => {
    authService.verifyLoginCode.mockResolvedValue({ token: 'jwt', userId: USER_ID });

    await verify(
      jsonRequest({
        path: '/api/auth/verify',
        body: { email: 'someone@example.com', code: '123456' },
      }),
      ROUTE_CONTEXT,
    );

    expect((await sentEvents()).map(({ event }) => event)).toEqual(['signed_up']);
  });

  it('records each transaction write from the web, without its amount or description', async () => {
    transactionService.createTransaction.mockResolvedValue({ id: TRANSACTION_ID });

    await createTransaction(
      jsonRequest({
        path: '/api/transactions',
        body: { description: 'Coffee', value: 18, type: 'EXPENSE' },
      }),
      ROUTE_CONTEXT,
    );
    await updateTransaction(
      jsonRequest({
        path: `/api/transactions/${TRANSACTION_ID}`,
        method: 'PUT',
        body: {
          description: 'Coffee',
          value: 20,
          type: 'EXPENSE',
          categoryId: '44444444-4444-4444-8444-444444444444',
          date: '2026-10-20',
        },
      }),
      ID_CONTEXT,
    );
    await deleteTransaction(
      jsonRequest({ path: `/api/transactions/${TRANSACTION_ID}`, method: 'DELETE' }),
      ID_CONTEXT,
    );

    const webWrite = { channel: 'web', app: 'my-expenses-website', environment: 'production' };
    expect((await sentEvents()).map(({ event, properties }) => [event, properties])).toEqual([
      ['transaction_created', webWrite],
      ['transaction_updated', webWrite],
      ['transaction_deleted', webWrite],
    ]);
  });

  it('records nothing when the write fails', async () => {
    transactionService.deleteTransaction.mockRejectedValue(new Error('database down'));

    await deleteTransaction(
      jsonRequest({ path: `/api/transactions/${TRANSACTION_ID}`, method: 'DELETE' }),
      ID_CONTEXT,
    );

    expect(await sentEvents()).toEqual([]);
  });

  it('records a statement uploaded for extraction', async () => {
    importService.processImport.mockResolvedValue({ id: 'import-1' });

    await processImport(
      jsonRequest({
        path: '/api/imports/process',
        body: {
          fileUrl: 'https://bucket.s3.eu-central-1.amazonaws.com/imports/statement.xlsx',
          originalFileName: 'statement.xlsx',
          paymentMonth: '10/2026',
        },
      }),
      ROUTE_CONTEXT,
    );

    expect((await sentEvents()).map(({ event }) => event)).toEqual(['statement_uploaded']);
  });

  it('records a message once the assistant has answered it', async () => {
    chatService.streamChatResponse.mockResolvedValue((async function* noReply() {})());

    const response = await chat(
      jsonRequest({
        path: '/api/chat',
        body: { messages: [{ sender: 'user', text: 'How much did I spend?' }] },
      }),
      ROUTE_CONTEXT,
    );
    await response.text();

    expect((await sentEvents()).map(({ event }) => event)).toEqual(['assistant_message_sent']);
  });

  it('records no assistant message when the reply fails', async () => {
    chatService.streamChatResponse.mockRejectedValue(new Error('model unavailable'));

    const response = await chat(
      jsonRequest({
        path: '/api/chat',
        body: { messages: [{ sender: 'user', text: 'How much did I spend?' }] },
      }),
      ROUTE_CONTEXT,
    );
    await response.text();

    expect(await sentEvents()).toEqual([]);
  });

  it('records the agent’s tool call and the transaction it added, on the agent channel', async () => {
    categoryRepository.getAllCategories.mockResolvedValue([]);
    transactionService.createTransaction.mockResolvedValue({
      id: TRANSACTION_ID,
      transaction: AGENT_TRANSACTION,
    });
    const agent = await connectAgent();

    await agent.callTool({
      name: 'add_transaction',
      arguments: { description: 'Coffee', amount: 18, type: 'EXPENSE' },
    });

    expect(
      (await sentEvents()).map(({ event, properties }) => ({
        event,
        channel: properties.channel,
        tool: properties.tool,
        outcome: properties.outcome,
      })),
    ).toEqual([
      { event: 'transaction_created', channel: 'agent', tool: undefined, outcome: undefined },
      { event: 'agent_tool_called', channel: undefined, tool: 'add_transaction', outcome: 'ok' },
    ]);
  });

  it.each([
    ['update_transaction', { id: TRANSACTION_ID, description: 'Tea' }, 'transaction_updated'],
    ['delete_transaction', { id: TRANSACTION_ID }, 'transaction_deleted'],
  ])('records the agent’s %s on the agent channel', async (tool, toolArguments, event) => {
    categoryRepository.getAllCategories.mockResolvedValue([]);
    transactionService.getTransactionItem.mockResolvedValue(AGENT_TRANSACTION);
    transactionService.updateTransaction.mockResolvedValue(AGENT_TRANSACTION);
    transactionService.deleteTransaction.mockResolvedValue(undefined);
    const agent = await connectAgent();

    await agent.callTool({ name: tool, arguments: toolArguments });

    expect(
      (await sentEvents()).map(({ event: name, properties }) => [name, properties.channel]),
    ).toEqual([
      [event, 'agent'],
      ['agent_tool_called', undefined],
    ]);
  });

  it.each([
    ['dashboard', DashboardLayout],
    ['transactions', TransactionsLayout],
    ['pending', PendingLayout],
    ['scheduled', ScheduledLayout],
    ['subscriptions', SubscriptionsLayout],
    ['imports', ImportsLayout],
    ['trends', TrendsLayout],
    ['settings', SettingsLayout],
  ])(
    'records a %s page view for the signed-in user when the page is entered',
    async (page, Layout) => {
      requestCookies.set(SESSION_COOKIE, await signToken(USER_ID));

      await Layout({ children: null });

      expect(await sentEvents()).toEqual([
        expect.objectContaining({
          event: 'page_viewed',
          distinct_id: `my-expenses-website:${USER_ID}`,
          properties: expect.objectContaining({ page }),
        }),
      ]);
    },
  );

  it('renders the page without a page view when the session token does not verify', async () => {
    requestCookies.set(SESSION_COOKIE, 'not-a-jwt');

    await expect(TransactionsLayout({ children: 'page' })).resolves.toBe('page');

    expect(await sentEvents()).toEqual([]);
  });

  it('never fails the request when PostHog is down', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    transactionService.createTransaction.mockResolvedValue({ id: TRANSACTION_ID });

    const response = await createTransaction(
      jsonRequest({
        path: '/api/transactions',
        body: { description: 'Coffee', value: 18, type: 'EXPENSE' },
      }),
      ROUTE_CONTEXT,
    );
    await observability.flushRemoteLogs();

    expect(response.status).toBe(201);
  });
});
