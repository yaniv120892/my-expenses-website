'use client';

import { Chip, Stack } from '@mui/material';
import { TrendPeriod, TransactionType } from '@/types/trends';
import { Category } from '@/types';
import { format } from 'date-fns';

interface TrendFiltersDisplayProps {
  period: TrendPeriod;
  startDate: Date;
  endDate: Date;
  selectedCategory: string;
  transactionType: TransactionType;
  categories: Category[];
  onOpenFilters: () => void;
}

export const TrendFiltersDisplay = ({
  period,
  startDate,
  endDate,
  selectedCategory,
  transactionType,
  categories,
  onOpenFilters,
}: TrendFiltersDisplayProps) => {
  const formatPeriod = (p: TrendPeriod) => {
    switch (p) {
      case 'weekly':
        return 'Weekly';
      case 'monthly':
        return 'Monthly';
      case 'yearly':
        return 'Yearly';
    }
  };

  const getCategoryName = () => {
    if (selectedCategory === 'All Categories') return 'All Categories';
    return categories.find((c) => c.id === selectedCategory)?.name || '';
  };

  const labels = [
    transactionType === 'EXPENSE' ? 'Expenses' : 'Income',
    formatPeriod(period),
    getCategoryName(),
    `${format(new Date(startDate), 'MMM d, yyyy')} – ${format(
      new Date(endDate),
      'MMM d, yyyy',
    )}`,
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
