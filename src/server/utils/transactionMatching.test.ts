import { describe, expect, it } from 'vitest';
import { TransactionType } from '@prisma/client';
import {
  findExactNormalizedMatch,
  isSameCharge,
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

describe('isSameCharge', () => {
  const base: { value: number; date: Date; type: TransactionType } = {
    value: 45,
    date: new Date('2026-03-05'),
    type: TransactionType.EXPENSE,
  };
  const charge = (
    overrides: Partial<typeof base & { description: string }>,
  ) => ({
    description: '',
    ...base,
    ...overrides,
  });

  it('matches identical descriptions', () => {
    expect(
      isSameCharge(
        charge({ description: 'Super Pharm' }),
        charge({ description: 'Super Pharm' }),
      ),
    ).toBe(true);
  });

  it('matches a description truncated down to most of its length', () => {
    expect(
      isSameCharge(
        charge({ description: 'Super Pharm Ramat Aviv' }),
        charge({ description: 'Super Pharm Ramat' }),
      ),
    ).toBe(true);
  });

  // The extraction service drops a merchant's trailing words — branch, mall,
  // city — between runs, and on real statements the location is usually
  // longer than the name, so the shortened side covers well under half.
  it.each([
    ['Super Pharm', 'Super Pharm Tlv Mall Complex'],
    ['רמי לוי', 'רמי לוי בן גוריון גבעתיים'],
    ['אמריקן איגל', 'אמריקן איגל קניון איילון'],
    ['צומת ספרים', 'צומת ספרים קניון אילון'],
    ['ביגה', 'ביגה קניון איילון'],
    ['קסטרו', 'קסטרו קניון אילון'],
    ['AMPM', 'AMPM אלנבי'],
  ])('matches a merchant shortened to its leading words: %s', (short, full) => {
    expect(
      isSameCharge(
        charge({ description: short }),
        charge({ description: full }),
      ),
    ).toBe(true);
  });

  it('matches a name cut inside its last word when most of it is kept', () => {
    expect(
      isSameCharge(
        charge({ description: 'שלומי קריבי עיצוב שיער' }),
        charge({ description: 'שלומי קריבי עיצוב שיערגב' }),
      ),
    ).toBe(true);
  });

  it('matches a refund whose leading word was dropped', () => {
    expect(
      isSameCharge(
        charge({ description: 'CashPro', type: TransactionType.INCOME }),
        charge({ description: 'החזר CashPro', type: TransactionType.INCOME }),
      ),
    ).toBe(true);
  });

  it('does not match a name that only ends the same way inside a word', () => {
    expect(
      isSameCharge(
        charge({ description: 'Pharm' }),
        charge({ description: 'Superpharm' }),
      ),
    ).toBe(false);
  });

  // Regression: a shared prefix used to be enough on its own, so two
  // distinct merchants charging the same amount on the same day (a real
  // coincidence, not a re-imported row) read as duplicates and the second
  // one silently never imported.
  it('does not match two different merchants that share an opening inside a word', () => {
    expect(
      isSameCharge(
        charge({ description: 'Super' }),
        charge({ description: 'Superland Water Park' }),
      ),
    ).toBe(false);
  });

  it('does not match two different merchants that share only their first word', () => {
    expect(
      isSameCharge(
        charge({ description: 'קפה גרג' }),
        charge({ description: 'קפה ג׳ו רמת גן' }),
      ),
    ).toBe(false);
  });

  it('does not let a bare initial stand for a merchant', () => {
    expect(
      isSameCharge(
        charge({ description: 'א' }),
        charge({ description: 'אלמה מרקט' }),
      ),
    ).toBe(false);
  });

  it('does not match when the value differs', () => {
    expect(
      isSameCharge(
        charge({ description: 'Super Pharm', value: 45 }),
        charge({ description: 'Super Pharm', value: 46 }),
      ),
    ).toBe(false);
  });

  it('does not match when the date differs', () => {
    expect(
      isSameCharge(
        charge({ description: 'Super Pharm', date: new Date('2026-03-05') }),
        charge({ description: 'Super Pharm', date: new Date('2026-03-06') }),
      ),
    ).toBe(false);
  });

  it('does not match when the type differs', () => {
    expect(
      isSameCharge(
        charge({ description: 'Super Pharm', type: TransactionType.EXPENSE }),
        charge({ description: 'Super Pharm', type: TransactionType.INCOME }),
      ),
    ).toBe(false);
  });

  it('treats two blank descriptions as the same charge', () => {
    expect(
      isSameCharge(charge({ description: '' }), charge({ description: '' })),
    ).toBe(true);
  });

  it('does not treat one blank description as evidence of sameness', () => {
    expect(
      isSameCharge(
        charge({ description: '' }),
        charge({ description: 'Super Pharm' }),
      ),
    ).toBe(false);
  });
});
