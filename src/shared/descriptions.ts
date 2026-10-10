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

export const MINIMUM_BANK_DESCRIPTION_PREFIX_LENGTH = 3;

// Measured after normalization, the form the matcher compares, so a prefix
// that is mostly punctuation is refused on save rather than never matching.
export function isUsableBankDescriptionPrefix(prefix: string): boolean {
  return (
    normalizeDescription(prefix).length >=
    MINIMUM_BANK_DESCRIPTION_PREFIX_LENGTH
  );
}
