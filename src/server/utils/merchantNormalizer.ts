const SUFFIX_PATTERN = /\b(inc|ltd|llc|com|co|corp|corporation|limited)\b/gi;
const TRAILING_DIGITS = /\d+$/;
const SPECIAL_CHARS = /[*#\-_.]/g;
const MULTIPLE_SPACES = /\s{2,}/g;

export function normalizeMerchantName(description: string): string {
  return description
    .toLowerCase()
    .trim()
    .replace(SUFFIX_PATTERN, '')
    .replace(TRAILING_DIGITS, '')
    .replace(SPECIAL_CHARS, ' ')
    .replace(MULTIPLE_SPACES, ' ')
    .trim();
}

export function toDisplayName(description: string): string {
  return description
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
