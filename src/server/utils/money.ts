import Decimal from 'decimal.js';

const MONEY_DECIMAL_PLACES = 2;
const RATE_DECIMAL_PLACES = 8;

// Half away from zero, so a refund rounds to the mirror of its charge.
const ROUNDING = Decimal.ROUND_HALF_UP;

export type DecimalInput = Decimal.Value | { toString(): string };

export function toMoneyString(amount: DecimalInput): string {
  return toDecimal(amount).toFixed(MONEY_DECIMAL_PLACES, ROUNDING);
}

export function toRateString(rate: DecimalInput): string {
  return toDecimal(rate).toFixed(RATE_DECIMAL_PLACES, ROUNDING);
}

export function toMoneyNumber(amount: DecimalInput): number {
  return Number(toMoneyString(amount));
}

/** originalAmount × rate, rounded once, at the end, to whole agorot. */
export function convertAmount(
  originalAmount: DecimalInput,
  rate: DecimalInput,
): number {
  return toMoneyNumber(toDecimal(originalAmount).times(toDecimal(rate)));
}

export function impliedRate(
  convertedAmount: DecimalInput,
  originalAmount: DecimalInput,
): string {
  return toRateString(
    toDecimal(convertedAmount).dividedBy(toDecimal(originalAmount)),
  );
}

export function isSameMoney(left: DecimalInput, right: DecimalInput): boolean {
  return toMoneyString(left) === toMoneyString(right);
}

function toDecimal(value: DecimalInput): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(
    typeof value === 'number' || typeof value === 'string'
      ? value
      : value.toString(),
  );
}
