// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Locale } from '@yaniv120892/my-ui';
import ScheduledTransactionList from '@/components/ScheduledTransactionList';
import { DesignTestProvider } from '@/test/renderWithClient';
import type { ScheduledTransaction } from '@/types';

const RENT: ScheduledTransaction = {
  id: 'rent',
  description: 'Rent',
  value: 5000,
  type: 'EXPENSE',
  categoryId: 'c1',
  scheduleType: 'MONTHLY',
  dayOfMonth: 1,
  nextRunDate: '2026-11-01',
};

function renderList(locale: Locale) {
  return render(
    <DesignTestProvider locale={locale}>
      <ScheduledTransactionList
        scheduledTransactions={[RENT]}
        categories={[{ id: 'c1', name: 'Housing' }]}
        onEditAction={vi.fn()}
      />
    </DesignTestProvider>,
  );
}

afterEach(cleanup);

describe('ScheduledTransactionList', () => {
  it('describes the schedule in English', () => {
    renderList('en');

    expect(screen.getByText('Runs every month on day 1.')).toBeTruthy();
    expect(screen.getByText('Next run')).toBeTruthy();
    expect(screen.getByText('Nov 1, 2026')).toBeTruthy();
  });

  it('describes the schedule in Hebrew, leaving the data as entered', () => {
    renderList('he');

    expect(screen.getByText('מתבצע כל חודש ב־1 לחודש.')).toBeTruthy();
    expect(screen.getByText('החיוב הבא')).toBeTruthy();
    expect(screen.getByText('Rent')).toBeTruthy();
    expect(screen.getByText('Housing')).toBeTruthy();
  });
});
