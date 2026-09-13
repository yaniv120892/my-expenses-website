import { TransactionType } from '@prisma/client';

// A statement row and a hand-logged transaction rarely agree exactly: the
// merchant string is spelled differently and the charged amount can drift from
// the amount that was typed. These are the tolerances that bridge that gap.
const MINIMUM_VALUE_TOLERANCE = 2;
const RELATIVE_VALUE_TOLERANCE = 0.01;

/**
 * A card dates a row by when the charge settled, which trails the purchase a
 * hand-logged transaction is dated by.
 */
export const CHARGE_DATE_DAY_RANGE = 5;

type ImportedCharge = {
  description: string;
  value: number;
  date: Date;
  type: TransactionType;
};

// Distinct from normalizeMerchantName in merchantNormalizer.ts, which answers a
// different question and must keep doing so: it strips corporate suffixes and
// trailing digits to derive a merchant's identity for subscription detection,
// which would fold "Cafe 123" and "Cafe 456" together. Matching one statement
// row to one transaction needs those digits kept and Hebrew niqqud folded away.
type NormalizedMatchCandidate = {
  id: string;
  description: string;
};

/** Folds away case, spacing, punctuation, Latin diacritics and Hebrew niqqud. */
export function normalizeDescription(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * The id of the one candidate whose description normalizes to the same string,
 * or null. A tie is deliberately null rather than the first hit: choosing
 * between equally-spelled candidates is what the model is for.
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

/** The dates and values a transaction must fall inside to be a candidate. */
export type MatchWindow = {
  earliestDate: Date;
  latestDate: Date;
  minimumValue: number;
  maximumValue: number;
};

export function matchWindow(date: Date, value: number): MatchWindow {
  const valueTolerance = matchValueTolerance(value);
  const earliestDate = new Date(date);
  earliestDate.setDate(earliestDate.getDate() - CHARGE_DATE_DAY_RANGE);
  const latestDate = new Date(date);
  latestDate.setDate(latestDate.getDate() + CHARGE_DATE_DAY_RANGE);

  return {
    earliestDate,
    latestDate,
    minimumValue: value - valueTolerance,
    maximumValue: value + valueTolerance,
  };
}

/** The in-memory form of the bounds the candidate query applies in SQL. */
export function isWithinMatchWindow(
  window: MatchWindow,
  charge: { date: Date; value: number },
): boolean {
  const time = charge.date.getTime();
  return (
    time >= window.earliestDate.getTime() &&
    time <= window.latestDate.getTime() &&
    charge.value >= window.minimumValue &&
    charge.value <= window.maximumValue
  );
}

/**
 * Whether two descriptions have no normalized word in common. A blank side
 * says nothing about the charge, so it is never read as unrelated.
 */
export function shareNoWord(left: string, right: string): boolean {
  const leftWords = toWords(left);
  const rightWords = new Set(toWords(right));
  const eitherBlank = leftWords.length === 0 || rightWords.size === 0;
  if (eitherBlank) {
    return false;
  }

  return !leftWords.some((word) => rightWords.has(word));
}

// The extraction service shortens a merchant by dropping words at an end —
// usually the trailing branch, mall or city, sometimes a leading "refund" —
// so a shortened name is a whole word or words from one end of the full one.
// A bare initial is not a shortened merchant, hence the minimum length; below
// it the amount and day would be doing all the work.
const MINIMUM_SHORTENED_MERCHANT_LENGTH = 3;
// A cut inside a word is a truncation rather than a shortening, and one that
// keeps most of the characters is still the same merchant; one that keeps a
// few is two merchants sharing an opening.
const MINIMUM_TRUNCATION_COVERAGE = 0.5;

/**
 * Whether two rows of one import describe the same charge. Date, value and
 * type must agree exactly; descriptions only have to agree as far as the
 * shorter one runs — to a word boundary, or most of the way into a word —
 * since the extraction service shortens the same merchant differently between
 * runs.
 */
export function isSameCharge(
  left: ImportedCharge,
  right: ImportedCharge,
): boolean {
  const sameAmountAndMoment =
    left.value === right.value &&
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
