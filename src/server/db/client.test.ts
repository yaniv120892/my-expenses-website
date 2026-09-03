import { beforeEach, describe, expect, it, vi } from 'vitest';

const { constructPrismaClient } = vi.hoisted(() => ({
  constructPrismaClient: vi.fn(),
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

vi.mock('@prisma/client', () => ({ PrismaClient: FakePrismaClient }));
vi.mock('prisma-field-encryption', () => ({
  fieldEncryptionExtension: () => ({}),
}));

beforeEach(() => {
  vi.resetModules();
  constructPrismaClient.mockClear();
  globalThis.__prisma = undefined;
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
});
