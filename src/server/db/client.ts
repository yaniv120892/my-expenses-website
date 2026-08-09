import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';
import { fieldEncryptionExtension } from 'prisma-field-encryption';

function createPrismaClient() {
  return new PrismaClient({ log: ['warn', 'error'] })
    .$extends(fieldEncryptionExtension())
    .$extends(withAccelerate());
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

declare global {
  // eslint-disable-next-line no-var
  var __prisma: ExtendedPrismaClient | undefined;
}

function getClient(): ExtendedPrismaClient {
  return (globalThis.__prisma ??= createPrismaClient());
}

// A lazy proxy: the edge client validates DATABASE_URL at construction, which
// must not happen at import time (it would fail the build and any route that
// merely imports a repository).
const prisma = new Proxy({} as ExtendedPrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default prisma;
