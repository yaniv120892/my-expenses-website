import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { cardDigitsEncryption } from '@/server/db/cardDigitsEncryption';
import { householdScopeGuard } from '@/server/db/householdScope';
import { requireEnv } from '@/server/env';
import { withVerifyFullSslMode } from '@/server/db/sslMode';

function createPrismaClient() {
  return new PrismaClient({
    // No statementNameGenerator, so every statement is unnamed and safe in a
    // pooler's reused sessions. One connection per serverless instance, and a
    // bounded wait: pg's default waits forever, past the function's timeout.
    adapter: new PrismaPg({
      connectionString: withVerifyFullSslMode(requireEnv('DATABASE_URL')),
      max: 1,
      connectionTimeoutMillis: 10_000,
    }),
    log: ['warn', 'error'],
  }).$extends(cardDigitsEncryption(requireEnv('PRISMA_FIELD_ENCRYPTION_KEY')));
}

type SystemPrismaClient = ReturnType<typeof createPrismaClient>;

function createScopedClient(system: SystemPrismaClient) {
  return system.$extends(householdScopeGuard());
}

type ScopedPrismaClient = ReturnType<typeof createScopedClient>;

declare global {
  var __prisma: SystemPrismaClient | undefined;
  var __scopedPrisma: ScopedPrismaClient | undefined;
}

function getSystemClient(): SystemPrismaClient {
  return (globalThis.__prisma ??= createPrismaClient());
}

// An extension of the same client, so both share one connection.
function getScopedClient(): ScopedPrismaClient {
  return (globalThis.__scopedPrisma ??= createScopedClient(getSystemClient()));
}

// Built on first use, so a missing DATABASE_URL fails the call rather than the
// import.
function lazily<Client extends object>(getClient: () => Client): Client {
  const lazyClientTarget: Client = Object.create(Object.prototype);
  return new Proxy(lazyClientTarget, {
    get(_target, property) {
      const client = getClient();
      const value = Reflect.get(client, property);
      return typeof value === 'function' ? value.bind(client) : value;
    },
  });
}

// Every household-owned query through this client must name its household
// (src/server/db/householdScope.ts).
const prisma = lazily(getScopedClient);

/**
 * Skips the household check, for the few jobs that work across households —
 * a cron's sweep, the extraction callback finding its import. Only
 * crossHouseholdRepository imports it, as householdScope.test.ts pins.
 */
export const systemPrisma = lazily(getSystemClient);

export default prisma;
