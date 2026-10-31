import type { HouseholdRole } from '@/generated/prisma/enums';

declare const householdIdBrand: unique symbol;

// Branded so a bare string, a user id included, cannot be passed where the
// scoping key belongs: every household-owned query takes one of these, and
// only toHouseholdId makes one, from an actor or a row already loaded.
export type HouseholdId = string & { readonly [householdIdBrand]: true };

// Who a request acts as. Loaded from the database on every request, never
// from the session token, so leaving, removal and role changes apply at once.
export type MemberActor = {
  kind: 'member';
  userId: string;
  householdId: HouseholdId;
  role: HouseholdRole;
  apiTokenId: string | null;
};

// A job no member started, acting inside one household at a time.
export type SystemActor = {
  kind: 'system';
  householdId: HouseholdId;
  job: SystemJob;
};

export type SystemJob = 'scheduled-transactions';

export type HouseholdActor = MemberActor | SystemActor;
