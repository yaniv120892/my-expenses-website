import type { HouseholdRole } from '@/generated/prisma/enums';

declare const householdIdBrand: unique symbol;

// Branded so a user id cannot be passed where the scoping key belongs: every
// household-owned query takes one of these, and only an actor or a row that
// already belongs to the household can produce it.
export type HouseholdId = string & { readonly [householdIdBrand]: true };

// Who a request acts as. Loaded from the database on every request, never
// from the session token, so leaving, removal and role changes apply at once.
export type MemberActor = {
  userId: string;
  householdId: HouseholdId;
  role: HouseholdRole;
  apiTokenId: string | null;
};
