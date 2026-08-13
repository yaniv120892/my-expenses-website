import { describe, expect, it } from 'vitest';
import {
  normalizeMerchantName,
  toDisplayName,
} from '@/server/utils/merchantNormalizer';

describe('normalizeMerchantName', () => {
  it('lowercases and trims', () => {
    expect(normalizeMerchantName('  SPOTIFY  ')).toBe('spotify');
  });

  it('strips corporate suffix words wherever they appear as whole words', () => {
    expect(normalizeMerchantName('Acme Inc')).toBe('acme');
    expect(normalizeMerchantName('Acme Corporation')).toBe('acme');
    expect(normalizeMerchantName('NETFLIX.COM')).toBe('netflix');
    expect(normalizeMerchantName('Coffee Co')).toBe('coffee');
  });

  it('does not strip suffix words embedded inside longer words', () => {
    expect(normalizeMerchantName('Colossal')).toBe('colossal');
    expect(normalizeMerchantName('Income')).toBe('income');
  });

  it('removes trailing digits but keeps leading and inner digits', () => {
    expect(normalizeMerchantName('SPOTIFY 12345')).toBe('spotify');
    expect(normalizeMerchantName('AMZN*Payment 98765')).toBe('amzn payment');
    expect(normalizeMerchantName('7-Eleven')).toBe('7 eleven');
    expect(normalizeMerchantName('365 Market')).toBe('365 market');
  });

  it('replaces *, #, -, _ and . with spaces and collapses runs of spaces', () => {
    expect(normalizeMerchantName('PAYPAL *SPOTIFY')).toBe('paypal spotify');
    expect(normalizeMerchantName('uber__trip')).toBe('uber trip');
    expect(normalizeMerchantName('a#b-c.d')).toBe('a b c d');
  });

  it('handles empty and digits-only input', () => {
    expect(normalizeMerchantName('')).toBe('');
    expect(normalizeMerchantName('12345')).toBe('');
  });

  it('strips a suffix word even when hyphenated to the rest of the name', () => {
    expect(normalizeMerchantName('co-op')).toBe('op');
  });
});

describe('toDisplayName', () => {
  it('capitalizes each word and lowercases the rest', () => {
    expect(toDisplayName('netflix')).toBe('Netflix');
    expect(toDisplayName('MCDONALDS')).toBe('Mcdonalds');
    expect(toDisplayName('amzn payment')).toBe('Amzn Payment');
  });

  it('normalizes surrounding and internal whitespace', () => {
    expect(toDisplayName('  hello   world  ')).toBe('Hello World');
  });

  it('returns an empty string for empty input', () => {
    expect(toDisplayName('')).toBe('');
  });

  it('leaves non-letter leading characters untouched', () => {
    expect(toDisplayName('7 eleven')).toBe('7 Eleven');
  });
});
