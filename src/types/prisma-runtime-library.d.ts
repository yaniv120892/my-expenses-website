// prisma-field-encryption types its extension through this Prisma 6 module,
// which Prisma 7 folded into runtime/client. Left unresolved it reads as `any`,
// and every query result of the extended client goes untyped with it.
declare module '@prisma/client/runtime/library' {
  export type { InternalArgs } from '@prisma/client/runtime/client';
}
