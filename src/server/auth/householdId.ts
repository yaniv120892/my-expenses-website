import type { HouseholdId } from '@/server/auth/householdActor.types';

export function toHouseholdId(value: string): HouseholdId {
  if (!isHouseholdId(value)) {
    throw new Error(`A household id must be a non-empty string (got "${value}")`);
  }
  return value;
}

export function isHouseholdId(value: unknown): value is HouseholdId {
  return typeof value === 'string' && value.length > 0;
}
