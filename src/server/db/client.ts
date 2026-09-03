import { PrismaClient } from '@prisma/client';
import { fieldEncryptionExtension } from 'prisma-field-encryption';

function createPrismaClient() {
  return new PrismaClient({ log: ['warn', 'error'] }).$extends(
    fieldEncryptionExtension(),
  );
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

declare global {
  // eslint-disable-next-line no-var
  var __prisma: ExtendedPrismaClient | undefined;
}

function getClient(): ExtendedPrismaClient {
  return (globalThis.__prisma ??= createPrismaClient());
}

// A lazy proxy: the client is built on first use, so a missing DATABASE_URL
// fails the call rather than the import of any module that reaches a
// repository.
const prisma = new Proxy({} as ExtendedPrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default prisma;
