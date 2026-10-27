'use client';

import { Chip, Stack } from '@mui/material';
import type { ComparisonScope, TrendPeriod, TransactionType, TrendsView } from '@/types/trends';
import type { Category } from '@/types';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import type { T } from '@/i18n/useT.types';
import { ALL_CATEGORIES } from './trendFilters';

interface TrendFiltersDisplayProps {
  period: TrendPeriod;
  startDate: Date;
  endDate: Date;
  selectedCategory: string;
  transactionType: TransactionType;
  comparisonCategoryIds: string[];
  comparisonScope: ComparisonScope;
  view: TrendsView;
  categories: Category[];
  onOpenFilters: () => void;
}

export const TrendFiltersDisplay = ({
  period,
  startDate,
  endDate,
  selectedCategory,
  transactionType,
  comparisonCategoryIds,
  comparisonScope,
  view,
  categories,
  onOpenFilters,
}: TrendFiltersDisplayProps) => {
  const t = useT();
  const formatter = useAppFormat();
  const periodLabel = t(`trends.period.${period}`);
  const dateRange = formatter.dateRange({ start: startDate, end: endDate });

  const categoryName =
    selectedCategory === ALL_CATEGORIES
      ? t('trends.allCategories')
      : categories.find((category) => category.id === selectedCategory)?.name || '';

  // Compare mode spans both transaction types and its own category selection,
  // so the overview's type and single-category chips would be misleading.
  const labels =
    view === 'compare'
      ? [
          periodLabel,
          comparisonCategoriesLabel({
            t,
            categories,
            comparisonCategoryIds,
          }),
          comparisonScope === 'SUBTREE'
            ? t('trends.scope.subtreeChip')
            : t('trends.scope.exactChip'),
          dateRange,
        ]
      : [
          transactionType === 'EXPENSE' ? t('trends.type.expense') : t('trends.type.income'),
          periodLabel,
          categoryName,
          dateRange,
        ];

  return (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      sx={{
        flexWrap: 'wrap',
        mb: 2,
      }}
    >
      {labels.map((label) => (
        <Chip key={label} label={label} variant="outlined" size="small" onClick={onOpenFilters} />
      ))}
    </Stack>
  );
};

function comparisonCategoriesLabel({
  t,
  categories,
  comparisonCategoryIds,
}: {
  t: T;
  categories: Category[];
  comparisonCategoryIds: string[];
}): string {
  if (comparisonCategoryIds.length === 1) {
    return (
      categories.find((category) => category.id === comparisonCategoryIds[0])?.name ||
      t('trends.categoryCount.one')
    );
  }
  return t('trends.categoryCount.other', {
    count: comparisonCategoryIds.length,
  });
}
