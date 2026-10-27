import { describe, expect, it } from 'vitest';
import { formatCurrency, formatCurrencyPlain, translateToScheduleSummary } from '@/utils/format';

const normalizeCurrency = (value: string) =>
  value.replace(/[\u200E\u200F]/g, '').replace(/\u00A0/g, ' ');

describe('formatCurrency', () => {
  it('formats as ILS with two decimals', () => {
    expect(normalizeCurrency(formatCurrency(1234.5))).toBe('1,234.50 ₪');
  });

  it('formats zero and negatives', () => {
    expect(normalizeCurrency(formatCurrency(0))).toBe('0.00 ₪');
    expect(normalizeCurrency(formatCurrency(-99))).toBe('-99.00 ₪');
  });
});

describe('formatCurrencyPlain', () => {
  // Asserted without normalizeCurrency on purpose: emitting a string that needs
  // no cleanup is the whole reason this variant exists.
  it('renders the same visible format with no control characters', () => {
    expect(formatCurrencyPlain(1234.5)).toBe('1,234.50 ₪');
    expect(formatCurrencyPlain(0)).toBe('0.00 ₪');
    expect(formatCurrencyPlain(-99)).toBe('-99.00 ₪');
  });

  it('strips the marks Intl adds', () => {
    expect(formatCurrencyPlain(1234.5)).not.toMatch(/[\u200e\u200f\u00a0]/);
    expect(formatCurrency(1234.5)).toMatch(/[\u200e\u200f\u00a0]/);
  });
});

describe('translateToScheduleSummary', () => {
  it('describes daily schedules with and without an interval', () => {
    expect(translateToScheduleSummary('DAILY', undefined, undefined, undefined)).toBe(
      'Runs every day.',
    );
    expect(translateToScheduleSummary('DAILY', 1, undefined, undefined)).toBe('Runs every day.');
    expect(translateToScheduleSummary('DAILY', 3, undefined, undefined)).toBe('Runs every 3 days.');
  });

  it('describes weekly schedules using a 1-based day of week', () => {
    expect(translateToScheduleSummary('WEEKLY', undefined, 1, undefined)).toBe(
      'Runs every week on Sunday.',
    );
    expect(translateToScheduleSummary('WEEKLY', 2, 7, undefined)).toBe(
      'Runs every 2 weeks on Saturday.',
    );
  });

  it('prompts for a day of week when it is missing or zero', () => {
    expect(translateToScheduleSummary('WEEKLY', 1, undefined, undefined)).toBe(
      'Choose a day of week.',
    );
    expect(translateToScheduleSummary('WEEKLY', 1, 0, undefined)).toBe('Choose a day of week.');
  });

  it('describes monthly schedules and prompts without a day of month', () => {
    expect(translateToScheduleSummary('MONTHLY', undefined, undefined, 15)).toBe(
      'Runs every month on day 15.',
    );
    expect(translateToScheduleSummary('MONTHLY', 6, undefined, 31)).toBe(
      'Runs every 6 months on day 31.',
    );
    expect(translateToScheduleSummary('MONTHLY', 1, undefined, undefined)).toBe(
      'Choose a day of month.',
    );
  });
});
