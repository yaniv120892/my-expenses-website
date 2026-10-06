import { describe, expect, it } from 'vitest';
import { parseKeySync } from '@47ng/cloak';
import {
  decryptCardDigits,
  encryptCardDigitsInput,
} from '@/server/db/cardDigitsEncryption';
import {
  CIPHERTEXT_FROM_AN_EARLIER_CLIENT,
  DIGITS_BEHIND_THAT_CIPHERTEXT,
  TEST_ENCRYPTION_KEY,
} from '@/test/encryptionFixture';

const key = parseKeySync(TEST_ENCRYPTION_KEY);

describe('card digits encryption', () => {
  it('encrypts the digits on write and decrypts them on read', () => {
    const written = encryptCardDigitsInput(
      { creditCardLastFourDigits: '1234', paymentMonth: '2026-03' },
      key,
    );

    expect(written.creditCardLastFourDigits).toMatch(/^v1\.aesgcm256\./);
    expect(written.paymentMonth).toBe('2026-03');
    expect(decryptCardDigits(written.creditCardLastFourDigits, key)).toBe(
      '1234',
    );
  });

  it('decrypts a value prisma-field-encryption stored', () => {
    expect(decryptCardDigits(CIPHERTEXT_FROM_AN_EARLIER_CLIENT, key)).toBe(
      DIGITS_BEHIND_THAT_CIPHERTEXT,
    );
  });

  it('passes null and a never-encrypted value through', () => {
    expect(
      encryptCardDigitsInput({ creditCardLastFourDigits: null }, key),
    ).toEqual({ creditCardLastFourDigits: null });
    expect(decryptCardDigits(null, key)).toBeNull();
    expect(decryptCardDigits('5678', key)).toBe('5678');
  });

  it('refuses an update operator it would otherwise store as plain text', () => {
    expect(() =>
      encryptCardDigitsInput(
        { creditCardLastFourDigits: { set: '1234' } },
        key,
      ),
    ).toThrow(/plain string/);
  });
});
