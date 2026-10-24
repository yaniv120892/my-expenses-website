import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { requireUser, transactionService } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  transactionService: { createTransaction: vi.fn() },
}));

vi.mock('@/server/auth/session', async () => ({
  ...(await vi.importActual<typeof import('@/server/auth/session')>(
    '@/server/auth/session',
  )),
  requireUser,
}));
vi.mock('@/server/services/transactionService', () => ({
  default: transactionService,
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

import { POST } from '@/app/api/transactions/route';

const ROUTE_CONTEXT = { params: Promise.resolve(undefined) };
const CATEGORY = { id: 'c-food', name: 'Food & Groceries' };

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue('user-1');
});

describe('POST /api/transactions', () => {
  it('answers with the id and suggested category, not the stored row', async () => {
    transactionService.createTransaction.mockResolvedValue({
      id: 'tx-1',
      suggestedCategory: CATEGORY,
      transaction: { id: 'tx-1', category: CATEGORY, value: 18 },
    });

    const response = await POST(
      new NextRequest('http://localhost/api/transactions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          description: 'Coffee',
          value: 18,
          type: 'EXPENSE',
        }),
      }),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: 'tx-1',
      suggestedCategory: CATEGORY,
    });
  });

  it('leaves an undated create undated, so the service stamps it with the app wall-clock time', async () => {
    transactionService.createTransaction.mockResolvedValue({
      id: 'tx-2',
      transaction: { id: 'tx-2' },
    });

    await POST(
      new NextRequest('http://localhost/api/transactions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          description: 'Coffee',
          value: 18,
          type: 'EXPENSE',
        }),
      }),
      ROUTE_CONTEXT,
    );

    expect(transactionService.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ date: null }),
    );
  });

  it.each([
    ['zero', 0],
    ['a negative amount', -5],
    ['an empty string', ''],
  ])(
    'refuses %s as the value without creating anything',
    async (_label, value) => {
      const response = await POST(
        new NextRequest('http://localhost/api/transactions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            description: 'Coffee',
            value,
            type: 'EXPENSE',
          }),
        }),
        ROUTE_CONTEXT,
      );

      expect(response.status).toBe(400);
      expect(JSON.stringify(await response.json())).toContain(
        'Amount must be a number greater than 0',
      );
      expect(transactionService.createTransaction).not.toHaveBeenCalled();
    },
  );
});
