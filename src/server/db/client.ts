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

const prisma = (globalThis.__prisma ??= createPrismaClient());

export default prisma;
