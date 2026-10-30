import { isAxiosError } from 'axios';
import { z } from 'zod';
import type { T } from '@/i18n/useT.types';
import { HOUSEHOLD_ERROR_CODES, type HouseholdErrorCode } from '@/shared/types/household';
import { describeApiError } from '@/utils/api';

const householdErrorBodySchema = z.object({ code: z.enum(HOUSEHOLD_ERROR_CODES) });

/** The household refusal a failed request carries, or null for any other failure. */
export function householdErrorCode(error: unknown): HouseholdErrorCode | null {
  if (!isAxiosError(error)) {
    return null;
  }
  return householdErrorBodySchema.safeParse(error.response?.data).data?.code ?? null;
}

/**
 * A household refusal in the reader's language; anything else as
 * `describeApiError` would put it.
 */
export function describeHouseholdError({
  error,
  fallback,
  t,
}: {
  error: unknown;
  fallback: string;
  t: T;
}): string {
  const code = householdErrorCode(error);
  return code ? t(`household.error.${code}`) : describeApiError(error, fallback);
}
