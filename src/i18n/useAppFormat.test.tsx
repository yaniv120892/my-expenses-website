// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Locale } from '@yaniv120892/my-ui';
import { DesignTestProvider } from '@/test/renderWithClient';
import { scheduleSummary, useAppFormat } from './useAppFormat';
import { useT } from './useT';

const NON_BREAKING_OR_BIDI = /[‎‏  ]/g;

function formatterFor(locale: Locale = 'en') {
  const { result } = renderHook(
    () => ({ t: useT(), formatter: useAppFormat() }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <DesignTestProvider locale={locale}>{children}</DesignTestProvider>
      ),
    },
  );
  return result.current;
}

function plain(text: string): string {
  return text.replace(NON_BREAKING_OR_BIDI, ' ').replace(/ +/g, ' ').trim();
}

describe('useAppFormat', () => {
  it('formats shekels for the locale', () => {
    expect(plain(formatterFor('en').formatter.currency(1234.5))).toBe(
      '₪1,234.50',
    );
    expect(plain(formatterFor('he').formatter.currency(1234.5))).toBe(
      '1,234.50 ₪',
    );
  });

  it('rounds shekels when asked', () => {
    const { formatter } = formatterFor('en');
    expect(plain(formatter.currencyRounded(14814.72))).toBe('₪14,815');
    expect(plain(formatter.currencyRounded(-99.4))).toBe('-₪99');
  });

  it('reads a date-only string as a local day, not UTC midnight', () => {
    expect(formatterFor('en').formatter.day('2024-02-29')).toBe('Feb 29, 2024');
  });

  it('names a day in Hebrew under the Hebrew locale', () => {
    expect(formatterFor('he').formatter.day('2024-02-29')).toContain('2024');
    expect(formatterFor('he').formatter.weekday(1)).toBe('יום ראשון');
  });

  it('shows percentage points to one decimal in both locales', () => {
    expect(plain(formatterFor('en').formatter.percentagePoints(12))).toBe(
      '12.0%',
    );
    expect(plain(formatterFor('he').formatter.percentagePoints(12.54))).toBe(
      '12.5%',
    );
    expect(
      plain(
        formatterFor('en').formatter.percentagePoints(3, {
          signDisplay: 'always',
        }),
      ),
    ).toBe('+3.0%');
  });

  it('shows megabytes to one decimal', () => {
    expect(formatterFor('en').formatter.megabytes(4)).toBe('4.0');
  });

  it('labels trend buckets per period', () => {
    const { formatter } = formatterFor('en');
    expect(formatter.trendDate('2024-02-29', 'daily')).toBe('Feb 29, 2024');
    expect(formatter.trendDate('2024-23', 'weekly')).toBe('Week 23');
    expect(formatter.trendDate('2024-02', 'monthly')).toBe('Feb 2024');
    expect(formatter.trendDate('2024', 'yearly')).toBe('2024');
    expect(formatterFor('he').formatter.trendDate('2024-23', 'weekly')).toBe(
      'שבוע 23',
    );
  });

  it('leaves a missing range bound blank', () => {
    const { formatter } = formatterFor('en');
    expect(
      formatter.dateRange({ start: '2024-01-15', end: '2024-02-29' }),
    ).toBe('Jan 15, 2024 – Feb 29, 2024');
    expect(formatter.dateRange({ start: '2024-01-15' })).toBe(
      'Jan 15, 2024 – ',
    );
  });

  it('shows the original amount beside the shekel amount', () => {
    const { formatter } = formatterFor('en');
    expect(
      plain(
        formatter.amountWithOriginal({
          value: 92.35,
          currency: 'USD',
          originalAmount: 25,
        }),
      ),
    ).toBe('$25.00 · ₪92.35');
    expect(
      formatter.amountWithOriginal({
        value: null,
        currency: null,
        originalAmount: 25,
      }),
    ).toBe('25 (currency unknown) · ILS amount missing');
  });
});

describe('scheduleSummary', () => {
  it('describes each schedule type in English', () => {
    const { t, formatter } = formatterFor('en');
    const summary = (
      schedule: Parameters<typeof scheduleSummary>[0]['schedule'],
    ) => scheduleSummary({ schedule, t, formatter });
    expect(summary({ scheduleType: 'DAILY' })).toBe('Runs every day.');
    expect(summary({ scheduleType: 'DAILY', interval: 3 })).toBe(
      'Runs every 3 days.',
    );
    expect(summary({ scheduleType: 'WEEKLY', interval: 2, dayOfWeek: 7 })).toBe(
      'Runs every 2 weeks on Saturday.',
    );
    expect(summary({ scheduleType: 'WEEKLY', dayOfWeek: 0 })).toBe(
      'Choose a day of week.',
    );
    expect(summary({ scheduleType: 'MONTHLY', dayOfMonth: 15 })).toBe(
      'Runs every month on day 15.',
    );
  });

  it('describes a weekly schedule in Hebrew', () => {
    const { t, formatter } = formatterFor('he');
    expect(
      scheduleSummary({
        schedule: { scheduleType: 'WEEKLY', dayOfWeek: 1 },
        t,
        formatter,
      }),
    ).toBe('מתבצע כל שבוע ביום ראשון.');
  });
});
