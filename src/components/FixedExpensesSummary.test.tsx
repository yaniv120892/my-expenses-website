// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Locale } from '@yaniv120892/my-ui';
import FixedExpensesSummary from '@/components/FixedExpensesSummary';
import { DesignTestProvider } from '@/test/renderWithClient';
import { ScheduledTransaction } from '@/types';

const OCTOBER_6 = new Date(2026, 9, 6, 12);

const RENT: ScheduledTransaction = {
  id: 'rent',
  description: 'Rent',
  value: 1000,
  type: 'EXPENSE',
  categoryId: 'category-1',
  scheduleType: 'MONTHLY',
  nextRunDate: '2026-10-10T00:00:00.000Z',
};

function renderIn(locale: Locale) {
  return render(
    <DesignTestProvider locale={locale}>
      <FixedExpensesSummary scheduledTransactions={[RENT]} today={OCTOBER_6} />
    </DesignTestProvider>,
  );
}

describe('FixedExpensesSummary', () => {
  afterEach(cleanup);

  it('names the month and counts the charges left in English', () => {
    renderIn('en');
    expect(screen.getByText('Fixed expenses left in October')).toBeTruthy();
    expect(screen.getByText('1 scheduled charge to go')).toBeTruthy();
  });

  it('reads in Hebrew, with the month name and amounts in Hebrew format', () => {
    renderIn('he');
    expect(screen.getByText('הוצאות קבועות שנותרו באוקטובר')).toBeTruthy();
    expect(screen.getByText('נותר עוד חיוב קבוע אחד')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'הוצאות קבועות' })).toBeTruthy();
    expect(screen.getAllByText(/1,000\.00/).length).toBeGreaterThan(0);
  });
});
