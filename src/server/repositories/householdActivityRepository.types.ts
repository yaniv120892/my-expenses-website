import type { Prisma } from '@/generated/prisma/client';

export type HouseholdActivityRow = Prisma.HouseholdActivityGetPayload<{
  include: { actorUser: { select: { username: true } } };
}>;
