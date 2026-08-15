'use client';

import { Chip, Button, Stack } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { TransactionFilters, Category } from '@/types';
import { formatDateRange } from '@/utils/dateUtils';

interface TransactionFiltersDisplayProps extends TransactionFilters {
  onOpenFilters: () => void;
  categories: Category[];
  onResetSearch: () => void;
  onResetCategory: () => void;
  onResetDateRange: () => void;
}

export const TransactionFiltersDisplay = ({
  searchTerm,
  categoryId,
  startDate,
  endDate,
  onOpenFilters,
  categories,
  onResetSearch,
  onResetCategory,
  onResetDateRange,
}: TransactionFiltersDisplayProps) => {
  const hasActiveFilters = searchTerm || categoryId || startDate || endDate;

  const getCategoryName = (id: string) => {
    const category = categories.find((cat) => cat.id === id);
    return category ? category.name : id;
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
      spacing={1}
    >
      <Button
        variant="outlined"
        size="small"
        startIcon={<FilterListIcon />}
        onClick={onOpenFilters}
      >
        Filters
      </Button>

      {hasActiveFilters && (
        <>
          {searchTerm && (
            <Chip
              label={`Search: ${searchTerm}`}
              variant="outlined"
              onClick={onOpenFilters}
              onDelete={onResetSearch}
            />
          )}
          {categoryId && (
            <Chip
              label={`Category: ${getCategoryName(categoryId)}`}
              variant="outlined"
              onClick={onOpenFilters}
              onDelete={onResetCategory}
            />
          )}
          {(startDate || endDate) && (
            <Chip
              label={`Date: ${formatDateRange(startDate, endDate)}`}
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
