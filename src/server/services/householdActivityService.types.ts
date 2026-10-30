import type {
  HouseholdActivityAction,
  HouseholdEntityType,
  HouseholdRole,
} from '@/generated/prisma/client';
import type { HouseholdId } from '@/server/auth/householdActor.types';

export type ActivityEntry = {
  action: HouseholdActivityAction;
  entityType: HouseholdEntityType;
  entityId: string;
  summary: string | null;
  role?: HouseholdRole;
  /** The actor's household unless named: a member who joins is recorded in the one they join. */
  householdId?: HouseholdId;
};
