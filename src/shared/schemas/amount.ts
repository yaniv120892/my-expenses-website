import { z } from 'zod';

// Amounts are stored as NUMERIC(14,2): anything under a cent rounds to zero,
// and the ceiling is far above any one personal transaction yet inside the
// column.
export const MINIMUM_AMOUNT = 0.01;
export const MAXIMUM_AMOUNT = 10_000_000;

export const POSITIVE_AMOUNT_MESSAGE = `Amount must be a number from ${MINIMUM_AMOUNT} to ${MAXIMUM_AMOUNT}`;

const NUMERIC_TEXT = /^\s*(\d+\.?\d*|\.\d+)\s*$/;

// The direction of money lives in the transaction type, so an amount is
// always strictly positive.
export const strictPositiveAmountSchema = z
  .number({ invalid_type_error: POSITIVE_AMOUNT_MESSAGE })
  .min(MINIMUM_AMOUNT, POSITIVE_AMOUNT_MESSAGE)
  .max(MAXIMUM_AMOUNT, POSITIVE_AMOUNT_MESSAGE);

// Form fields arrive as text. Only plain decimal text becomes a number: a
// blank field, `true` or `[5]` is refused rather than coerced to 0, 1 or 5.
export const positiveAmountSchema = z.preprocess(
  numericTextToNumber,
  strictPositiveAmountSchema,
);

// A rate has no cent floor (a weak currency's rate is well under 0.01).
export const positiveRateSchema = z.preprocess(
  numericTextToNumber,
  z
    .number({ invalid_type_error: 'exchangeRate must be a positive number' })
    .finite()
    .positive('exchangeRate must be a positive number'),
);

export function isPositiveAmount(raw: unknown): boolean {
  return positiveAmountSchema.safeParse(raw).success;
}

function numericTextToNumber(raw: unknown): unknown {
  if (typeof raw !== 'string') {
    return raw;
  }
  return NUMERIC_TEXT.test(raw) ? Number(raw) : Number.NaN;
}
