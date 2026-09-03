import { describe, expect, it } from 'vitest';
import {
  findExactNormalizedMatch,
  matchValueTolerance,
  normalizeDescription,
} from '@/server/utils/transactionMatching';

describe('normalizeDescription', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeDescription('  Super   PHARM  ')).toBe('super pharm');
  });

  it('drops punctuation and symbols', () => {
    expect(normalizeDescription('SHUFERSAL-DEAL, TEL-AVIV (#12)')).toBe(
      'shufersal deal tel aviv 12',
    );
  });

  it('keeps digits, which distinguish branches', () => {
    expect(normalizeDescription('Cafe 123')).toBe('cafe 123');
  });

  it('strips latin diacritics', () => {
    expect(normalizeDescription('Café Ramón')).toBe('cafe ramon');
  });

  it('preserves Hebrew letters', () => {
    expect(normalizeDescription('  סופר פארם  ')).toBe('סופר פארם');
  });

  // Only the marks come off: pointed spelling drops the mater lectionis vav
  // that unpointed spelling carries, and no normalization can put it back.
  it('strips Hebrew niqqud down to the consonants', () => {
    expect(normalizeDescription('שֻׁפֶּרְסָל')).toBe('שפרסל');
  });

  it('normalizes a description of only punctuation to empty', () => {
    expect(normalizeDescription('--- ...')).toBe('');
  });
});

describe('findExactNormalizedMatch', () => {
  const candidates = [
    { id: 'transaction-1', description: 'Super Pharm' },
    { id: 'transaction-2', description: 'Shufersal Deal' },
  ];

  it('returns the id of the single candidate that normalizes equal', () => {
    expect(findExactNormalizedMatch('SUPER-PHARM', candidates)).toBe(
      'transaction-1',
    );
  });

  it('matches across punctuation and spacing differences', () => {
    expect(findExactNormalizedMatch('  shufersal   deal!  ', candidates)).toBe(
      'transaction-2',
    );
  });

  it('matches Hebrew descriptions', () => {
    expect(
      findExactNormalizedMatch('סופר פארם', [
        { id: 'transaction-3', description: '  סופר פארם ' },
      ]),
    ).toBe('transaction-3');
  });

  it('returns null when nothing normalizes equal', () => {
    expect(findExactNormalizedMatch('Rami Levy', candidates)).toBeNull();
  });

  // A tie is exactly the case the model exists to resolve, so it must not be
  // decided here by candidate order.
  it('returns null when several candidates normalize equal', () => {
    expect(
      findExactNormalizedMatch('Super Pharm', [
        { id: 'transaction-1', description: 'Super Pharm' },
        { id: 'transaction-2', description: 'super-pharm' },
      ]),
    ).toBeNull();
  });

  it('returns null for a description that normalizes to empty', () => {
    expect(
      findExactNormalizedMatch('...', [
        { id: 'transaction-1', description: '' },
      ]),
    ).toBeNull();
  });

  it('returns null when there are no candidates', () => {
    expect(findExactNormalizedMatch('Super Pharm', [])).toBeNull();
  });
});

describe('matchValueTolerance', () => {
  it('keeps a floor for small charges, where a percentage would be uselessly tight', () => {
    expect(matchValueTolerance(20)).toBe(2);
  });

  it('scales with the charge once the percentage exceeds the floor', () => {
    expect(matchValueTolerance(2000)).toBe(20);
  });

  it('crosses over from floor to percentage at 200', () => {
    expect(matchValueTolerance(200)).toBe(2);
    expect(matchValueTolerance(201)).toBeCloseTo(2.01);
  });

  it('treats income and expense sign-symmetrically', () => {
    expect(matchValueTolerance(-2000)).toBe(20);
  });
});
