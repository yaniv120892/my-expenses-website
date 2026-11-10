import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SessionModule from '@/server/auth/session';
import type * as NextServerModule from 'next/server';
import { NextRequest } from 'next/server';
import { installFakeCounterStore } from '@/test/fakeCounterStore';

const { requireUser, processImport, rematchImport, putImportObject } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  processImport: vi.fn(),
  rematchImport: vi.fn(),
  putImportObject: vi.fn(),
}));

vi.mock('@/server/auth/householdActor', async () =>
  (await import('@/test/memberActor')).householdActorWithTestMembers(),
);
vi.mock('@/server/auth/session', async () => ({
  ...(await vi.importActual<typeof SessionModule>('@/server/auth/session')),
  requireUser,
}));
vi.mock('@/server/services/importService', () => ({
  importService: { processImport, rematchImport },
}));
vi.mock('@/server/services/importFileStorage', () => ({
  importsBucket: () => ({}),
  putImportObject,
}));
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof NextServerModule>('next/server')),
  after: vi.fn(),
}));

import { POST as upload } from '@/app/api/imports/upload/route';
import { POST as processStatement } from '@/app/api/imports/process/route';
import { POST as rematch } from '@/app/api/imports/[importId]/rematch/route';
import { STATEMENTS_PER_DAY, STATEMENTS_PER_HOUR } from '@/server/costFences';

const counters = installFakeCounterStore();
const IMPORT_ID = '00000000-0000-4000-8000-000000000001';
const STATIC_ROUTE_CONTEXT = { params: Promise.resolve(undefined) };
const HOUR_MS = 60 * 60 * 1000;
const START_OF_DAY = Date.UTC(2026, 10, 10);

function uploadStatement(): Promise<Response> {
  const form = new FormData();
  form.append('file', new File(['x'], 'visa.xlsx'));
  return upload(
    new NextRequest('http://localhost/api/imports/upload', { method: 'POST', body: form }),
    STATIC_ROUTE_CONTEXT,
  );
}

function submitStatement(): Promise<Response> {
  return processStatement(
    new NextRequest('http://localhost/api/imports/process', {
      method: 'POST',
      body: JSON.stringify({
        fileUrl: 'https://bucket.test/imports/user-1/file.xlsx',
        originalFileName: 'visa.xlsx',
      }),
    }),
    STATIC_ROUTE_CONTEXT,
  );
}

function rematchStatement(): Promise<Response> {
  return rematch(
    new NextRequest(`http://localhost/api/imports/${IMPORT_ID}/rematch`, { method: 'POST' }),
    { params: Promise.resolve({ importId: IMPORT_ID }) },
  );
}

async function statusesOf(send: () => Promise<Response>, times: number): Promise<number[]> {
  const statuses: number[] = [];
  for (let sent = 0; sent < times; sent += 1) {
    statuses.push((await send()).status);
  }
  return statuses;
}

/** Sends a day's quota two an hour, under the hourly limit, then once more late that day. */
async function statusAfterDailyQuota(send: () => Promise<Response>): Promise<number> {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    for (let sent = 0; sent < STATEMENTS_PER_DAY; sent += 1) {
      vi.setSystemTime(START_OF_DAY + sent * HOUR_MS * 0.5);
      expect((await send()).status).toBe(200);
    }
    vi.setSystemTime(START_OF_DAY + 23 * HOUR_MS);
    vi.clearAllMocks();
    return (await send()).status;
  } finally {
    vi.useRealTimers();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ userId: 'user-1', tokenVersion: 0 });
  processImport.mockResolvedValue({ id: IMPORT_ID });
  rematchImport.mockResolvedValue(undefined);
  putImportObject.mockResolvedValue('https://bucket.test/imports/user-1/file.xlsx');
});

describe('statement upload limits', () => {
  it('stores up to the hourly limit per household and refuses the next upload unstored', async () => {
    expect(await statusesOf(uploadStatement, STATEMENTS_PER_HOUR)).toEqual(
      Array(STATEMENTS_PER_HOUR).fill(200),
    );
    putImportObject.mockClear();

    const refused = await uploadStatement();

    expect(refused.status).toBe(429);
    await expect(refused.json()).resolves.toMatchObject({ code: 'RATE_LIMITED' });
    expect(putImportObject).not.toHaveBeenCalled();
  });

  it('holds a daily upload quota across hours', async () => {
    expect(await statusAfterDailyQuota(uploadStatement)).toBe(429);
    expect(putImportObject).not.toHaveBeenCalled();
  });

  it('counts by household, so another household still uploads', async () => {
    await statusesOf(uploadStatement, STATEMENTS_PER_HOUR);
    requireUser.mockResolvedValue({ userId: 'user-2', tokenVersion: 0 });

    expect((await uploadStatement()).status).toBe(200);
    expect(counters.keys().some((key) => key.includes('household:household-of-user-2'))).toBe(true);
  });

  it('fails closed when the counter store is down', async () => {
    counters.goDown();

    expect((await uploadStatement()).status).toBe(503);
    expect(putImportObject).not.toHaveBeenCalled();
  });
});

describe('statement processing limits', () => {
  it('processes up to the hourly limit per household and refuses the next without extraction', async () => {
    expect(await statusesOf(submitStatement, STATEMENTS_PER_HOUR)).toEqual(
      Array(STATEMENTS_PER_HOUR).fill(200),
    );
    processImport.mockClear();

    expect((await submitStatement()).status).toBe(429);
    expect(processImport).not.toHaveBeenCalled();
  });

  it('holds a daily processing quota across hours', async () => {
    expect(await statusAfterDailyQuota(submitStatement)).toBe(429);
    expect(processImport).not.toHaveBeenCalled();
  });

  it('shares the processing limit with re-matching, which reruns the paid matching', async () => {
    await statusesOf(submitStatement, STATEMENTS_PER_HOUR);

    expect((await rematchStatement()).status).toBe(429);
    expect(rematchImport).not.toHaveBeenCalled();
  });

  it('fails closed when the counter store is down', async () => {
    counters.goDown();

    expect((await submitStatement()).status).toBe(503);
    expect((await rematchStatement()).status).toBe(503);
    expect(processImport).not.toHaveBeenCalled();
    expect(rematchImport).not.toHaveBeenCalled();
  });
});
