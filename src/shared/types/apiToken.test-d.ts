import { expectTypeOf, test } from 'vitest';
import type { ApiTokenScope as PrismaApiTokenScope } from '@/generated/prisma/client';
import type { ApiTokenScope } from '@/shared/types/apiToken';

test('the shared scope list matches the database enum', () => {
  expectTypeOf<ApiTokenScope>().toEqualTypeOf<PrismaApiTokenScope>();
});
