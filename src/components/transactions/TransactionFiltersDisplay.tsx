'use client';

import { Chip, Button, Stack } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { TransactionFilters, Category } from '@/types';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';

type TransactionFiltersDisplayProps = TransactionFilters & {
  onOpenFilters: () => void;
  categories: Category[];
  onResetSearch: () => void;
  onResetCategory: () => void;
  onResetDateRange: () => void;
  onResetType: () => void;
};

const TYPE_LABEL_KEYS = {
  INCOME: 'common.income',
  EXPENSE: 'common.expense',
} as const;

export const TransactionFiltersDisplay = ({
  searchTerm,
  categoryId,
  type,
  startDate,
  endDate,
  onOpenFilters,
  categories,
  onResetSearch,
  onResetCategory,
  onResetDateRange,
  onResetType,
}: TransactionFiltersDisplayProps) => {
  const t = useT();
  const formatter = useAppFormat();
  const hasActiveFilters =
    searchTerm || categoryId || type || startDate || endDate;

  const getCategoryName = (id: string) => {
    const category = categories.find((cat) => cat.id === id);
    return category ? category.name : id;
  };

  return (
    <Stack
      direction="row"
      useFlexGap
      spacing={1}
      sx={{
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <Button
        variant="outlined"
        size="small"
        startIcon={<FilterListIcon />}
        onClick={onOpenFilters}
      >
        {t('common.filters')}
      </Button>

      {hasActiveFilters && (
        <>
          {searchTerm && (
            <Chip
              label={t('transactions.filters.chip.search', {
                value: searchTerm,
              })}
              variant="outlined"
              onClick={onOpenFilters}
              onDelete={onResetSearch}
            />
          )}
          {categoryId && (
            <Chip
              label={t('transactions.filters.chip.category', {
                value: getCategoryName(categoryId),
              })}
              variant="outlined"
              onClick={onOpenFilters}
              onDelete={onResetCategory}
            />
          )}
          {type && (
            <Chip
              label={t('transactions.filters.chip.type', {
                value: t(TYPE_LABEL_KEYS[type]),
              })}
              variant="outlined"
              onDelete={onResetType}
            />
          )}
          {(startDate || endDate) && (
            <Chip
              label={t('transactions.filters.chip.date', {
                value: formatter.dateRange({ start: startDate, end: endDate }),
              })}
              variant="outlined"
              onClick={onOpenFilters}
              onDelete={onResetDateRange}
            />
          )}
        </>
      )}
    </Stack>
  );
};
