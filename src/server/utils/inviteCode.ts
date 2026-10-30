import { randomInt } from 'node:crypto';

// Crockford base32 minus I, L, O and U: no character pairs that get misread
// when the code is read aloud or retyped from a message.
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const INVITE_CODE_LENGTH = 8;

const INVITE_TTL_DAYS = 14;

export function generateInviteCode(): string {
  let code = '';
  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** Accepts what a human retyped: lowercase, spaces, dashes, and O/I/L/U for 0/1/1/V. */
export function normalizeInviteCode(rawCode: string): string {
  return rawCode
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V');
}

export function inviteExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}
