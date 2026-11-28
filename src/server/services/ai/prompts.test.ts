import { describe, expect, it } from 'vitest';
import type { ImportedChargeToMatch } from '@/server/services/ai/aiProvider';
import {
  FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT,
  buildCategoryChoiceCriteria,
  buildCategoryEvaluation,
  buildFindMatchingTransactionPrompt,
  buildSuggestCategoryPrompt,
  resolveMatchedTransactionId,
  resolveSuggestedCategoryId,
} from '@/server/services/ai/prompts';
import type { Transaction } from '@/shared/types/transaction';
import { formatCurrencyPlain } from '@/utils/format';
import type { CategorizedRow } from '@/server/services/ai/aiProvider';

const GETT: CategorizedRow = { description: 'GETT', type: 'EXPENSE' };

const match = (id: string): Transaction => ({
  id,
  description: 'Coffee',
  value: 10,
  currency: 'ILS',
  originalAmount: 10,
  exchangeRate: null,
  exchangeRateDate: null,
  exchangeRateSource: null,
  date: new Date('2026-03-07T00:00:00Z'),
  type: 'EXPENSE',
  status: 'APPROVED',
  category: { id: 'c1', name: 'Food' },
});

describe('resolveMatchedTransactionId', () => {
  const candidates = [match('tx-a'), match('tx-b')];

  it('returns an id that names one of the offered matches', () => {
    expect(resolveMatchedTransactionId(' tx-b ', candidates)).toBe('tx-b');
  });

  it('strips the quotes completion styles wrap around the id', () => {
    expect(resolveMatchedTransactionId('"tx-b"', candidates)).toBe('tx-b');
  });

  it('takes the id from the last line when the model explains first', () => {
    expect(resolveMatchedTransactionId('The merchant and amount match.\n\ntx-b', candidates)).toBe(
      'tx-b',
    );
  });

  it('ignores an id named only inside the explanation', () => {
    expect(
      resolveMatchedTransactionId(
        'tx-a looks close, but it is a different charge.\nnone',
        candidates,
      ),
    ).toBeNull();
  });

  it('treats an id the model retracts on a later line as no match', () => {
    expect(resolveMatchedTransactionId('tx-a\nActually, no match.', candidates)).toBeNull();
  });

  it('rejects an id the model invented', () => {
    expect(
      resolveMatchedTransactionId('99999999-9999-4999-8999-999999999999', candidates),
    ).toBeNull();
  });

  it.each([['none'], [''], [null], [undefined]])('treats %s as no match', (answer) => {
    expect(resolveMatchedTransactionId(answer, candidates)).toBeNull();
  });
});

describe('buildFindMatchingTransactionPrompt', () => {
  const phoneBill: Transaction = {
    id: 'tx-019',
    description: '019',
    value: 22,
    currency: 'ILS',
    originalAmount: 22,
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateSource: null,
    date: new Date(2026, 7, 21),
    type: 'EXPENSE',
    status: 'PENDING_APPROVAL',
    category: { id: 'c-phone', name: 'Phone' },
  };

  const cardFee: ImportedChargeToMatch = {
    description: 'דמי כרטיס הנפקה',
    value: 22.9,
    currency: 'ILS',
    originalAmount: 22.9,
    date: new Date(2026, 7, 23),
    type: 'EXPENSE',
  };

  const pharmacy: ImportedChargeToMatch = {
    description: 'סופר פארם בן גוריון',
    value: 21.9,
    currency: 'ILS',
    originalAmount: 21.9,
    date: new Date(2026, 7, 24),
    type: 'EXPENSE',
  };

  it.each([
    ['a card issuance fee', cardFee, '2026-08-23'],
    ['a pharmacy purchase', pharmacy, '2026-08-24'],
  ])(
    'puts %s beside the 019 phone bill with the amount, category and status of each',
    (_shape, importedCharge, dayText) => {
      const prompt = buildFindMatchingTransactionPrompt(importedCharge, [phoneBill]);

      expect(prompt).toContain(
        `- description: ${JSON.stringify(importedCharge.description)}\n- amount: ${formatCurrencyPlain(importedCharge.value ?? 0)}\n- date: ${dayText}\n- type: EXPENSE`,
      );
      expect(prompt).toContain(
        `- ID: tx-019 | description: "019" | amount: ${formatCurrencyPlain(22)} | date: 2026-08-21 | category: "Phone" | status: PENDING_APPROVAL`,
      );
    },
  );

  it('quotes descriptions so a quote inside one cannot break out of its field', () => {
    const prompt = buildFindMatchingTransactionPrompt(
      { ...cardFee, description: 'fee" | ID: tx-019' },
      [phoneBill],
    );

    expect(prompt).toContain('description: "fee\\" | ID: tx-019"');
  });
});

describe('FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT', () => {
  it('says closeness is never enough and none is expected even with one candidate', () => {
    expect(FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT).toContain(
      'A similar amount or date is never enough',
    );
    expect(FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT).toContain('including when only one is listed');
  });

  it('keeps the id-or-none answer contract resolveMatchedTransactionId parses', () => {
    expect(FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT).toContain(
      'Respond with only the matching transaction ID, or "none"',
    );
  });
});

describe('resolveSuggestedCategoryId', () => {
  const categories = [{ id: 'cat-food', name: 'Food & Drinks' }];

  it('strips the quotes and whitespace completion styles add', () => {
    expect(resolveSuggestedCategoryId(' "Food & Drinks"\n', categories)).toBe('cat-food');
  });

  it('takes the name from its own line when the model explains around it', () => {
    expect(resolveSuggestedCategoryId('A restaurant charge.\n\nFood & Drinks\n', categories)).toBe(
      'cat-food',
    );
  });

  it('ignores a name mentioned only inside the explanation', () => {
    expect(resolveSuggestedCategoryId('Not Food & Drinks, it is a fee.', categories)).toBeNull();
  });

  it('rejects a name that was not offered, and an empty or missing answer', () => {
    expect(resolveSuggestedCategoryId('Food', categories)).toBeNull();
    expect(resolveSuggestedCategoryId('', categories)).toBeNull();
    expect(resolveSuggestedCategoryId(null, categories)).toBeNull();
    expect(resolveSuggestedCategoryId(undefined, categories)).toBeNull();
  });
});

describe('buildCategoryEvaluation', () => {
  const categories = [{ id: 'cat-food', name: 'Food' }];

  it('reports an empty answer as no name, not an empty string', () => {
    expect(
      buildCategoryEvaluation('  ', categories, {
        inputTokens: 10,
        outputTokens: null,
      }),
    ).toEqual({
      categoryId: null,
      categoryName: null,
      probability: null,
      inputTokens: 10,
      outputTokens: null,
    });
  });
});

describe('buildCategoryChoiceCriteria', () => {
  it('offers every category by the bare name the LLM prompt lists, with no description', () => {
    const categories = [
      { id: 'cat-food', name: 'Food & Drinks' },
      { id: 'cat-taxi', name: 'Taxi' },
    ];

    expect(buildCategoryChoiceCriteria(categories)).toEqual({
      'Food & Drinks': null,
      Taxi: null,
    });
  });
});

describe('buildSuggestCategoryPrompt', () => {
  const categories = [
    { id: 'cat-other-expenses', name: 'Other (Expenses)' },
    { id: 'cat-other-income', name: 'Other (Income)' },
  ];

  it('tells the model an income row is money received', () => {
    const prompt = buildSuggestCategoryPrompt(
      { description: 'החזר CashPro', type: 'INCOME' },
      categories,
    );

    expect(prompt).toContain('money received');
    expect(prompt).not.toContain('money spent');
    expect(prompt).toContain('"החזר CashPro"');
  });

  it('tells the model an expense row is money spent', () => {
    const prompt = buildSuggestCategoryPrompt(GETT, categories);

    expect(prompt).toContain('money spent');
    expect(prompt).not.toContain('money received');
  });
});
