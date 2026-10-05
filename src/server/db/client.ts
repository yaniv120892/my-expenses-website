import { PrismaPg } from '@prisma/adapter-pg';
import { fieldEncryptionExtension } from 'prisma-field-encryption';
import fieldEncryptionDmmf from '@/generated/field-encryption/dmmf.json';
import { PrismaClient } from '@/generated/prisma/client';
import { requireEnv } from '@/server/env';

function createPrismaClient() {
  return new PrismaClient({
    adapter: pgAdapter(requireEnv('DATABASE_URL')),
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
// node-postgres ignores `connection_limit`, so it is read here as the pool size.
function pgAdapter(databaseUrl: string): PrismaPg {
  const connectionLimit = new URL(databaseUrl).searchParams.get(
    'connection_limit',
  );
  return new PrismaPg({
    connectionString: databaseUrl,
    ...(connectionLimit ? { max: Number(connectionLimit) } : {}),
  });
}

export default prisma;
