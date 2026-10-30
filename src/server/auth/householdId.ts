import type { HouseholdId } from '@/server/auth/householdActor.types';

export function toHouseholdId(value: string): HouseholdId {
  if (!isHouseholdId(value)) {
    throw new Error(`A household id must be a non-empty string (got "${value}")`);
  }
  return value;
}

function isHouseholdId(value: string): value is HouseholdId {
  return value.length > 0;
}
