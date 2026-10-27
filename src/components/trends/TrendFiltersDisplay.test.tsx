// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Locale } from '@yaniv120892/my-ui';
import { DesignTestProvider } from '@/test/renderWithClient';
import { TrendFiltersDisplay } from './TrendFiltersDisplay';
import { ALL_CATEGORIES } from './trendFilters';

const CATEGORIES = [
  { id: 'category-food', name: 'Food' },
  { id: 'category-rent', name: 'Rent' },
];

function renderDisplay({ locale, view }: { locale: Locale; view: 'overview' | 'compare' }) {
  return render(
    <DesignTestProvider locale={locale}>
      <TrendFiltersDisplay
        period="monthly"
        startDate={new Date(2026, 0, 1)}
        endDate={new Date(2026, 5, 30)}
        selectedCategory={ALL_CATEGORIES}
        transactionType="EXPENSE"
        comparisonCategoryIds={['category-food', 'category-rent']}
        comparisonScope="SUBTREE"
        view={view}
        categories={CATEGORIES}
        onOpenFilters={vi.fn()}
      />
    </DesignTestProvider>,
  );
}

describe('TrendFiltersDisplay', () => {
  afterEach(cleanup);

  it('labels the overview filters in English', () => {
    renderDisplay({ locale: 'en', view: 'overview' });
    expect(screen.getByText('Expenses')).toBeTruthy();
    expect(screen.getByText('Monthly')).toBeTruthy();
    expect(screen.getByText('All Categories')).toBeTruthy();
    expect(screen.getByText('Jan 1, 2026 – Jun 30, 2026')).toBeTruthy();
  });

  it('labels the comparison filters in Hebrew', () => {
    renderDisplay({ locale: 'he', view: 'compare' });
    expect(screen.getByText('חודשי')).toBeTruthy();
    expect(screen.getByText('2 קטגוריות')).toBeTruthy();
    expect(screen.getByText('כולל תתי־קטגוריות')).toBeTruthy();
  });
});
