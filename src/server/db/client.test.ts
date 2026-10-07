import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { constructPrismaClient, constructAdapter } = vi.hoisted(() => ({
  constructPrismaClient: vi.fn(),
  constructAdapter: vi.fn(),
}));

class FakePrismaClient {
  constructor(options: unknown) {
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
  constructor(options: unknown) {
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

const POSTGRES_URL = 'postgresql://user:pass@host/db';

beforeEach(() => {
  vi.resetModules();
  constructPrismaClient.mockClear();
  constructAdapter.mockClear();
  globalThis.__prisma = undefined;
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
    const { default: prisma } = await import('@/server/db/client');
    void prisma.$queryRaw;

    expect(constructAdapter).toHaveBeenCalledWith({
      connectionString: POSTGRES_URL,
      max: 1,
      connectionTimeoutMillis: 10_000,
    });
    expect(constructPrismaClient).toHaveBeenCalledWith(
      expect.objectContaining({ adapter: expect.any(FakePrismaPg) }),
    );
  });
});
