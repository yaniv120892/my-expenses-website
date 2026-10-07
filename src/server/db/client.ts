import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { cardDigitsEncryption } from '@/server/db/cardDigitsEncryption';
import { requireEnv } from '@/server/env';

function createPrismaClient() {
  return new PrismaClient({
    // No statementNameGenerator, so every statement is unnamed and safe in a
    // pooler's reused sessions. One connection per serverless instance, and a
    // bounded wait: pg's default waits forever, past the function's timeout.
    adapter: new PrismaPg({
      connectionString: requireEnv('DATABASE_URL'),
      max: 1,
      connectionTimeoutMillis: 10_000,
    }),
    log: ['warn', 'error'],
  }).$extends(cardDigitsEncryption(requireEnv('PRISMA_FIELD_ENCRYPTION_KEY')));
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

declare global {
  var __prisma: ExtendedPrismaClient | undefined;
}

function getClient(): ExtendedPrismaClient {
  return (globalThis.__prisma ??= createPrismaClient());
}

// Built on first use, so a missing DATABASE_URL fails the call rather than the
// import.
const prisma = new Proxy({} as ExtendedPrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default prisma;
