import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { currentActorContext } from '@/server/db/actorContext';
import { attributionStamp } from '@/server/db/attribution';
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
  })
    .$extends(cardDigitsEncryption(requireEnv('PRISMA_FIELD_ENCRYPTION_KEY')))
    .$extends(attributionStamp());
}

type SystemPrismaClient = ReturnType<typeof createPrismaClient>;

function createScopedClient(system: SystemPrismaClient) {
  return system.$extends(householdScopeGuard());
}

type ScopedPrismaClient = ReturnType<typeof createScopedClient>;

// What an interactive transaction hands its callback: the client without the
// members that manage connections and transactions.
export type ScopedTransactionClient = Omit<
  ScopedPrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

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
// import. `joinedTransaction`, when it returns one, answers in the client's place.
function lazily<Client extends object>(
  getClient: () => Client,
  joinedTransaction: () => ScopedTransactionClient | undefined = () => undefined,
): Client {
  const lazyClientTarget: Client = Object.create(Object.prototype);
  return new Proxy(lazyClientTarget, {
    get(_target, property) {
      const transaction = joinedTransaction();
      if (transaction && property === '$transaction') {
        return runNestedIn(transaction);
      }
      const client: object = transaction ?? getClient();
      const value = Reflect.get(client, property);
      return typeof value === 'function' ? value.bind(client) : value;
    },
  });
}

/**
 * A transaction client has no `$transaction`; a repository that opens its own
 * runs inside the joined one instead, which is what nesting means here.
 */
function runNestedIn(transaction: ScopedTransactionClient) {
  return async function runNested(work: unknown) {
    if (typeof work === 'function') {
      return work(transaction);
    }
    const results: unknown[] = [];
    for (const operation of Array.isArray(work) ? work : []) {
      results.push(await operation);
    }
    return results;
  };
}

// Every household-owned query through this client must name its household
// (src/server/db/householdScope.ts). Inside householdActivityService.record it
// is that record's transaction, so the change and its activity row commit
// together without each repository being handed a transaction client.
const prisma = lazily(getScopedClient, () => currentActorContext()?.transaction);

/**
 * Skips the household check, for the few jobs that work across households —
 * a cron's sweep, the extraction callback finding its import. Only
 * crossHouseholdRepository imports it, as householdScope.test.ts pins.
 */
export const systemPrisma = lazily(getSystemClient);

export default prisma;
