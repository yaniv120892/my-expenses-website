import { z } from 'zod';

export const POSITIVE_AMOUNT_MESSAGE = 'Amount must be a number greater than 0';

// A blank field would coerce to 0 and fail as "too small"; it is reported as
// not being a number at all, which is what the user did wrong.
function blankToNaN(raw: unknown): unknown {
  return typeof raw === 'string' && raw.trim() === '' ? Number.NaN : raw;
}

// The direction of money lives in the transaction type, so an amount is
// always strictly positive.
export const positiveAmountSchema = z.preprocess(
  blankToNaN,
  z.coerce
    .number({ invalid_type_error: POSITIVE_AMOUNT_MESSAGE })
    .finite(POSITIVE_AMOUNT_MESSAGE)
    .positive(POSITIVE_AMOUNT_MESSAGE),
);

export const strictPositiveAmountSchema = z
  .number({ invalid_type_error: POSITIVE_AMOUNT_MESSAGE })
  .finite(POSITIVE_AMOUNT_MESSAGE)
  .positive(POSITIVE_AMOUNT_MESSAGE);

export function isPositiveAmount(raw: unknown): boolean {
  return positiveAmountSchema.safeParse(raw).success;
}
