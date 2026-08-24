'use client';

import { Chip, Stack } from '@mui/material';
import {
  ComparisonScope,
  TrendPeriod,
  TransactionType,
  TrendsView,
} from '@/types/trends';
import { Category } from '@/types';
import { formatDateRange } from '@/utils/dateUtils';

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
  const formatPeriod = (p: TrendPeriod) => {
    switch (p) {
      case 'daily':
        return 'Daily';
      case 'weekly':
        return 'Weekly';
      case 'monthly':
        return 'Monthly';
      case 'yearly':
        return 'Yearly';
    }
  };

  const getCategoryName = () => {
    if (selectedCategory === 'All Categories') {
      return 'All Categories';
    }
    return categories.find((c) => c.id === selectedCategory)?.name || '';
  };

  // Compare mode spans both transaction types and its own category selection,
  // so the overview's type and single-category chips would be misleading.
  const labels =
    view === 'compare'
      ? [
          formatPeriod(period),
          comparisonCategoryIds.length === 1
            ? categories.find((c) => c.id === comparisonCategoryIds[0])?.name ||
              '1 category'
            : `${comparisonCategoryIds.length} categories`,
          comparisonScope === 'SUBTREE'
            ? 'Including subcategories'
            : 'Exact categories',
          formatDateRange(startDate, endDate, '–'),
        ]
      : [
          transactionType === 'EXPENSE' ? 'Expenses' : 'Income',
          formatPeriod(period),
          getCategoryName(),
          formatDateRange(startDate, endDate, '–'),
        ];

  return (
    <Stack
      direction="row"
      spacing={1}
      flexWrap="wrap"
      useFlexGap
      sx={{ mb: 2 }}
    >
      {labels.map((label) => (
        <Chip
          key={label}
          label={label}
          variant="outlined"
          size="small"
          onClick={onOpenFilters}
        />
      ))}
    </Stack>
  );
};
