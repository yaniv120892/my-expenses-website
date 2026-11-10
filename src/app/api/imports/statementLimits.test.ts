import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SessionModule from '@/server/auth/session';
import type * as NextServerModule from 'next/server';
import { NextRequest } from 'next/server';
import { createFakeCounterStore, FAKE_COUNTER_STORE_ENV } from '@/test/fakeCounterStore';

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
import {
  STATEMENT_PROCESSING_RATE_LIMITS,
  STATEMENT_UPLOAD_RATE_LIMITS,
} from '@/server/costFences';

const counters = createFakeCounterStore();
const IMPORT_ID = '00000000-0000-4000-8000-000000000001';
const [UPLOADS_PER_HOUR] = STATEMENT_UPLOAD_RATE_LIMITS.map((policy) => policy.limit);
const [PROCESSING_PER_HOUR, PROCESSING_PER_DAY] = STATEMENT_PROCESSING_RATE_LIMITS.map(
  (policy) => policy.limit,
);

function uploadStatement(): Promise<Response> {
  const form = new FormData();
  form.append('file', new File(['x'], 'visa.xlsx'));
  return upload(
    new NextRequest('http://localhost/api/imports/upload', { method: 'POST', body: form }),
    { params: Promise.resolve(undefined) },
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
    { params: Promise.resolve(undefined) },
  );
}

function rematchStatement(): Promise<Response> {
  return rematch(
    new NextRequest(`http://localhost/api/imports/${IMPORT_ID}/rematch`, { method: 'POST' }),
    { params: Promise.resolve({ importId: IMPORT_ID }) },
  );
}

async function statusesOf(
  send: () => Promise<Response>,
  times: number | undefined,
): Promise<number[]> {
  const statuses: number[] = [];
  for (let sent = 0; sent < (times ?? 0); sent += 1) {
    statuses.push((await send()).status);
  }
  return statuses;
}

beforeAll(() => {
  vi.stubGlobal('fetch', counters.fetch);
  for (const [name, value] of Object.entries(FAKE_COUNTER_STORE_ENV)) {
    vi.stubEnv(name, value);
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  counters.reset();
  requireUser.mockResolvedValue({ userId: 'user-1', tokenVersion: 0 });
  processImport.mockResolvedValue({ id: IMPORT_ID });
  rematchImport.mockResolvedValue(undefined);
  putImportObject.mockResolvedValue('https://bucket.test/imports/user-1/file.xlsx');
});

describe('statement upload limits', () => {
  it('stores up to the hourly limit per household and refuses the next upload unstored', async () => {
    expect(new Set(await statusesOf(uploadStatement, UPLOADS_PER_HOUR))).toEqual(new Set([200]));
    putImportObject.mockClear();

    const refused = await uploadStatement();

    expect(refused.status).toBe(429);
    await expect(refused.json()).resolves.toMatchObject({ code: 'RATE_LIMITED' });
    expect(putImportObject).not.toHaveBeenCalled();
  });

  it('counts by household, so another household still uploads', async () => {
    await statusesOf(uploadStatement, UPLOADS_PER_HOUR);
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
    expect(new Set(await statusesOf(submitStatement, PROCESSING_PER_HOUR))).toEqual(new Set([200]));
    processImport.mockClear();

    expect((await submitStatement()).status).toBe(429);
    expect(processImport).not.toHaveBeenCalled();
  });

  it('holds a daily quota across hours', async () => {
    const hourMs = 60 * 60 * 1000;
    const startOfDay = Date.UTC(2026, 10, 10);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      for (let sent = 0; sent < (PROCESSING_PER_DAY ?? 0); sent += 1) {
        vi.setSystemTime(startOfDay + sent * hourMs * 0.5);
        expect((await submitStatement()).status).toBe(200);
      }
      vi.setSystemTime(startOfDay + 23 * hourMs);
      processImport.mockClear();

      expect((await submitStatement()).status).toBe(429);
      expect(processImport).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shares the processing limit with re-matching, which reruns the paid matching', async () => {
    await statusesOf(submitStatement, PROCESSING_PER_HOUR);

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
