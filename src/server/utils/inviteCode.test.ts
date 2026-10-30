import { describe, expect, it } from 'vitest';
import {
  generateInviteCode,
  INVITE_CODE_LENGTH,
  inviteExpiryFrom,
  normalizeInviteCode,
} from '@/server/utils/inviteCode';

describe('generateInviteCode', () => {
  it('draws only unambiguous characters, at the fixed length', () => {
    for (let index = 0; index < 200; index += 1) {
      expect(generateInviteCode()).toMatch(
        new RegExp(`^[0-9A-HJKMNP-TV-Z]{${INVITE_CODE_LENGTH}}$`),
      );
    }
  });
});

describe('normalizeInviteCode', () => {
  it('undoes what a human does when retyping a code', () => {
    expect(normalizeInviteCode(' abcd-ef 12 ')).toBe('ABCDEF12');
    expect(normalizeInviteCode('o1lu')).toBe('011V');
  });

  it('leaves a generated code as it is', () => {
    const code = generateInviteCode();
    expect(normalizeInviteCode(code)).toBe(code);
  });
});

describe('inviteExpiryFrom', () => {
  it('expires fourteen days on', () => {
    expect(inviteExpiryFrom(new Date('2026-10-01T10:00:00Z')).toISOString()).toBe(
      '2026-10-15T10:00:00.000Z',
    );
  });
});
