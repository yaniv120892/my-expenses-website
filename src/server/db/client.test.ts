import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { constructPrismaClient, constructAdapter, joined } = vi.hoisted(() => {
  const openTransaction: { transaction?: object } = {};
  return {
    constructPrismaClient: vi.fn(),
    constructAdapter: vi.fn(),
    joined: openTransaction,
  };
});

class FakePrismaClient {
  public constructor(options: unknown) {
    constructPrismaClient(options);
  }

  public $extends(): this {
    return this;
  }

  public $queryRaw(): Promise<unknown[]> {
    return Promise.resolve([]);
  }

  public $disconnect(): Promise<void> {
    return Promise.resolve();
  }
}

class FakePrismaPg {
  public constructor(public readonly options: unknown) {
    constructAdapter(options);
  }
}

vi.mock('@/generated/prisma/client', () => ({
  PrismaClient: FakePrismaClient,
}));
vi.mock('@prisma/adapter-pg', () => ({ PrismaPg: FakePrismaPg }));
vi.mock('@/server/db/cardDigitsEncryption', () => ({
  cardDigitsEncryption: () => ({}),
}));
vi.mock('@/server/db/householdScope', () => ({
  householdScopeGuard: () => ({}),
}));
vi.mock('@/server/db/attribution', () => ({
  attributionStamp: () => ({}),
}));
vi.mock('@/server/db/actorContext', () => ({
  currentActorContext: () => joined,
}));

const POSTGRES_URL = 'postgresql://user:pass@host/db';

beforeEach(() => {
  vi.resetModules();
  constructPrismaClient.mockClear();
  constructAdapter.mockClear();
  globalThis.__prisma = undefined;
  globalThis.__scopedPrisma = undefined;
  joined.transaction = undefined;
  vi.stubEnv('DATABASE_URL', POSTGRES_URL);
  vi.stubEnv('PRISMA_FIELD_ENCRYPTION_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the app Prisma client', () => {
  it('constructs nothing while the module is only imported', async () => {
    await import('@/server/db/client');

    expect(constructPrismaClient).not.toHaveBeenCalled();
  });

  it('constructs one client on first use and reuses it afterwards', async () => {
    const { default: prisma } = await import('@/server/db/client');

    expect(prisma.$queryRaw).toBeTypeOf('function');
    expect(constructPrismaClient).toHaveBeenCalledTimes(1);

    expect(prisma.$disconnect).toBeTypeOf('function');
    expect(constructPrismaClient).toHaveBeenCalledTimes(1);
  });

  it('fails the first call, not the import, when DATABASE_URL is unset', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const { default: prisma } = await import('@/server/db/client');

    expect(() => prisma.$queryRaw).toThrow('DATABASE_URL');
  });

  it('connects a Postgres URL through the pg adapter, one connection with a bounded wait', async () => {
    vi.stubEnv('DATABASE_URL', `${POSTGRES_URL}?sslmode=require`);
    const { default: prisma } = await import('@/server/db/client');
    void prisma.$queryRaw;

    expect(constructAdapter).toHaveBeenCalledWith({
      connectionString: `${POSTGRES_URL}?sslmode=verify-full`,
      max: 1,
      connectionTimeoutMillis: 10_000,
    });
    expect(constructPrismaClient).toHaveBeenCalledWith(
      expect.objectContaining({ adapter: expect.any(FakePrismaPg) }),
    );
  });
});

describe('a query made inside householdActivityService.record', () => {
  function openTransaction() {
    const findMany = vi.fn().mockResolvedValue(['from the transaction']);
    const transaction = { transaction: { findMany } };
    joined.transaction = transaction;
    return { transaction, findMany };
  }

  it('runs on the open transaction, not a fresh connection', async () => {
    const { default: prisma } = await import('@/server/db/client');
    const { findMany } = openTransaction();

    expect(await prisma.transaction.findMany()).toEqual(['from the transaction']);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(constructPrismaClient).not.toHaveBeenCalled();
  });

  it('runs a repository’s own $transaction inside the open one', async () => {
    const { default: prisma } = await import('@/server/db/client');
    const { transaction } = openTransaction();

    const nestedClient = await prisma.$transaction(async (nested) => nested);
    const batched = await prisma.$transaction([
      prisma.transaction.findMany(),
      prisma.transaction.findMany(),
    ]);

    expect(nestedClient).toBe(transaction);
    expect(batched).toEqual([['from the transaction'], ['from the transaction']]);
    expect(constructPrismaClient).not.toHaveBeenCalled();
  });
});
