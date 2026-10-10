import { TransactionStatus, TransactionType } from '@/generated/prisma/client';
import { addDays, subDays } from 'date-fns';
import { type DecimalInput, isSameMoney } from '@/server/utils/money';
import { isForeignCurrency } from '@/shared/currency';
import {
  isUsableBankDescriptionPrefix,
  normalizeDescription,
} from '@/shared/descriptions';

const MINIMUM_VALUE_TOLERANCE = 2;
const RELATIVE_VALUE_TOLERANCE = 0.01;

/**
 * A card dates a row by when the charge settled, which trails the purchase a
 * hand-logged transaction is dated by.
 */
export const CHARGE_DATE_DAY_RANGE = 5;

type ImportedCharge = {
  description: string;
  value: number | null;
  currency: string | null;
  originalAmount: DecimalInput;
  date: Date;
  type: TransactionType;
};

// Not normalizeMerchantName: that strips trailing digits for subscription
// identity, folding "Cafe 123" into "Cafe 456".
type NormalizedMatchCandidate = {
  id: string;
  description: string;
};

/**
 * A tie is null rather than the first hit: choosing between equally spelled
 * candidates is the model's job.
 */
export function findExactNormalizedMatch(
  description: string,
  candidates: NormalizedMatchCandidate[],
): string | null {
  const normalized = normalizeDescription(description);
  if (!normalized) {
    return null;
  }

  const matches = candidates.filter(
    (candidate) => normalizeDescription(candidate.description) === normalized,
  );

  return matches.length === 1 ? matches[0].id : null;
}

/**
 * How far a candidate's value may sit from the imported row's and still be
 * considered. Relative, because a flat tolerance that is generous for a 20
 * charge is far too tight for a 2000 one.
 */
export function matchValueTolerance(value: number): number {
  return Math.max(
    MINIMUM_VALUE_TOLERANCE,
    Math.abs(value) * RELATIVE_VALUE_TOLERANCE,
  );
}

/**
 * `value` is the ILS amount, null while it is unknown. A foreign charge also
 * matches on its original amount, because the ILS a hand-logged entry was
 * converted at rarely equals what the card billed.
 */
export type MatchableCharge = {
  date: Date;
  value: number | null;
  type: TransactionType;
  currency: string | null;
  originalAmount: number;
};

type AmountRange = { minimum: number; maximum: number };

export type MatchWindow = {
  // value is a positive magnitude with the direction in `type`, so without it
  // a refund is a candidate for the charge it reverses — and merging would
  // rewrite the refund into an expense.
  type: TransactionType;
  earliestDate: Date;
  latestDate: Date;
  valueRange: AmountRange | null;
  originalAmountRange: (AmountRange & { currency: string }) | null;
};

export function matchWindow(charge: MatchableCharge): MatchWindow {
  return {
    type: charge.type,
    earliestDate: subDays(charge.date, CHARGE_DATE_DAY_RANGE),
    latestDate: addDays(charge.date, CHARGE_DATE_DAY_RANGE),
    valueRange: charge.value === null ? null : toleranceRange(charge.value),
    originalAmountRange:
      charge.currency !== null && isForeignCurrency(charge.currency)
        ? {
            currency: charge.currency,
            ...toleranceRange(charge.originalAmount),
          }
        : null,
  };
}

export function canMatch(window: MatchWindow): boolean {
  return window.valueRange !== null || window.originalAmountRange !== null;
}

/** The in-memory form of the bounds the candidate query applies in SQL. */
export function isWithinMatchWindow(
  window: MatchWindow,
  candidate: MatchableCharge,
): boolean {
  return (
    isWithinDateWindow(window, candidate) && isAmountInWindow(window, candidate)
  );
}

export type MatchCandidate = MatchableCharge & {
  description: string;
  status: TransactionStatus;
  bankDescriptionPrefix: string | null;
};

/**
 * Whether a candidate may be paired with `charge`, built once per charge so the
 * window and the normalized description are not rebuilt for every candidate.
 * A pending transaction projected from a variable-amount schedule is paired by
 * the bank's description instead of by value, since no fixed value would
 * survive the value window.
 */
export function matchCandidateFilter(
  charge: MatchableCharge & { description: string },
): (candidate: MatchCandidate) => boolean {
  const window = matchWindow(charge);
  const normalizedDescription = normalizeDescription(charge.description);
  return (candidate) => {
    if (isVariableAmountPlaceholder(candidate)) {
      return (
        isWithinDateWindow(window, candidate) &&
        startsWithNormalizedPrefix(
          normalizedDescription,
          candidate.bankDescriptionPrefix,
        )
      );
    }

    return isWithinMatchWindow(window, candidate);
  };
}

export function isVariableAmountPlaceholder(
  candidate: MatchCandidate,
): candidate is MatchCandidate & { bankDescriptionPrefix: string } {
  return (
    candidate.status === TransactionStatus.PENDING_APPROVAL &&
    candidate.bankDescriptionPrefix !== null
  );
}

export function startsWithBankDescriptionPrefix(
  description: string,
  prefix: string,
): boolean {
  return startsWithNormalizedPrefix(normalizeDescription(description), prefix);
}

export function dateDistance(
  charge: MatchableCharge,
  candidate: MatchableCharge,
): number {
  return Math.abs(candidate.date.getTime() - charge.date.getTime());
}

/** `candidates` must not be empty. */
export function closestInDate<T extends MatchableCharge>(
  charge: MatchableCharge,
  candidates: T[],
): T {
  return candidates.reduce((best, candidate) =>
    dateDistance(charge, candidate) < dateDistance(charge, best)
      ? candidate
      : best,
  );
}

function startsWithNormalizedPrefix(
  normalizedDescription: string,
  prefix: string,
): boolean {
  return (
    isUsableBankDescriptionPrefix(prefix) &&
    normalizedDescription.startsWith(normalizeDescription(prefix))
  );
}

function isWithinDateWindow(
  window: MatchWindow,
  candidate: MatchableCharge,
): boolean {
  const time = candidate.date.getTime();
  return (
    candidate.type === window.type &&
    time >= window.earliestDate.getTime() &&
    time <= window.latestDate.getTime()
  );
}

function isAmountInWindow(
  window: MatchWindow,
  candidate: MatchableCharge,
): boolean {
  const valueFits =
    window.valueRange !== null &&
    candidate.value !== null &&
    isInRange(candidate.value, window.valueRange);
  const originalAmountFits =
    window.originalAmountRange !== null &&
    candidate.currency === window.originalAmountRange.currency &&
    isInRange(candidate.originalAmount, window.originalAmountRange);
  return valueFits || originalAmountFits;
}

function toleranceRange(amount: number): AmountRange {
  const tolerance = matchValueTolerance(amount);
  return { minimum: amount - tolerance, maximum: amount + tolerance };
}

function isInRange(amount: number, range: AmountRange): boolean {
  return amount >= range.minimum && amount <= range.maximum;
}

// A blank side says nothing about the charge, so it is never read as unrelated.
export function shareNoWord(left: string, right: string): boolean {
  const leftWords = toWords(left);
  const rightWords = new Set(toWords(right));
  const eitherBlank = leftWords.length === 0 || rightWords.size === 0;
  if (eitherBlank) {
    return false;
  }

  return !leftWords.some((word) => rightWords.has(word));
}

// The extraction service shortens a merchant by dropping whole words at an end.
// Below this length a bare initial would leave the amount and day doing all the
// work.
const MINIMUM_SHORTENED_MERCHANT_LENGTH = 3;
// A cut inside a word is a truncation rather than a shortening, and one that
// keeps most of the characters is still the same merchant; one that keeps a
// few is two merchants sharing an opening.
const MINIMUM_TRUNCATION_COVERAGE = 0.5;

/**
 * Date, amount, currency and type agree exactly; descriptions only as far as
 * the shorter one runs, since the extraction service shortens merchants
 * differently between runs.
 */
export function isSameCharge(
  left: ImportedCharge,
  right: ImportedCharge,
): boolean {
  const sameAmountAndMoment =
    left.value === right.value &&
    left.currency === right.currency &&
    isSameMoney(left.originalAmount, right.originalAmount) &&
    left.date.getTime() === right.date.getTime() &&
    left.type === right.type;
  if (!sameAmountAndMoment) {
    return false;
  }

  const leftDescription = normalizeDescription(left.description);
  const rightDescription = normalizeDescription(right.description);
  const eitherBlank = !leftDescription || !rightDescription;
  const bothBlank = !leftDescription && !rightDescription;
  // One side blank is no evidence of sameness; both blank leaves the amount,
  // day and direction as the only thing either row says.
  if (eitherBlank) {
    return bothBlank;
  }
  if (leftDescription === rightDescription) {
    return true;
  }

  return isTruncatedMerchantMatch(leftDescription, rightDescription);
}

function isTruncatedMerchantMatch(a: string, b: string): boolean {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length < MINIMUM_SHORTENED_MERCHANT_LENGTH) {
    return false;
  }

  if (longer.startsWith(shorter)) {
    const endsOnWordBoundary = longer[shorter.length] === ' ';
    const keepsMostOfTheWord =
      shorter.length >= longer.length * MINIMUM_TRUNCATION_COVERAGE;
    return endsOnWordBoundary || keepsMostOfTheWord;
  }

  // A dropped leading word: a refund's "החזר X" comes back as "X".
  const startsOnWordBoundary =
    longer[longer.length - shorter.length - 1] === ' ';
  return longer.endsWith(shorter) && startsOnWordBoundary;
}

function toWords(description: string): string[] {
  const normalized = normalizeDescription(description);
  return normalized ? normalized.split(' ') : [];
}
