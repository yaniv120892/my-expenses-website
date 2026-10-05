import { PrismaPg } from '@prisma/adapter-pg';
import { fieldEncryptionExtension } from 'prisma-field-encryption';
import fieldEncryptionDmmf from '@/generated/field-encryption/dmmf.json';
import { PrismaClient } from '@/generated/prisma/client';
import { requireEnv } from '@/server/env';

// These two speak Prisma's HTTP protocol (prisma dev's proxy, Accelerate); any
// other address is a Postgres connection string for node-postgres.
const PRISMA_HTTP_PROTOCOLS = ['prisma:', 'prisma+postgres:'];

type ConnectionOptions = { accelerateUrl: string } | { adapter: PrismaPg };

function createPrismaClient() {
  return new PrismaClient({
    ...connectionOptions(requireEnv('DATABASE_URL')),
    log: ['warn', 'error'],
  }).$extends(fieldEncryptionExtension({ dmmf: fieldEncryptionDmmf }));
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

// No statementNameGenerator: the adapter then sends every statement unnamed,
// which a transaction pooler can route to any backend without collisions.
function connectionOptions(databaseUrl: string): ConnectionOptions {
  if (PRISMA_HTTP_PROTOCOLS.includes(new URL(databaseUrl).protocol)) {
    return { accelerateUrl: databaseUrl };
  }
  return { adapter: new PrismaPg({ connectionString: databaseUrl }) };
}

export default prisma;
