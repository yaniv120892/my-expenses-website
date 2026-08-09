'use client';

import { Box, Chip, Button, Stack, Tooltip } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { TransactionFilters, Category } from '@/types';
import { format } from 'date-fns';

interface TransactionFiltersDisplayProps extends TransactionFilters {
  onOpenFilters: () => void;
  categories: Category[];
  onResetSearch: () => void;
  onResetCategory: () => void;
  onResetDateRange: () => void;
  smartSearch?: boolean;
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
  smartSearch,
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
              label={
                <Box
                  component="span"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  {smartSearch && (
                    <Tooltip title="Smart Search is enabled (typo-tolerant, flexible search)">
                      <AutoFixHighIcon color="primary" fontSize="small" />
                    </Tooltip>
                  )}
                  <span>{`Search: ${searchTerm}`}</span>
                </Box>
              }
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
              label={`Date: ${
                startDate ? format(new Date(startDate), 'MMM d, yyyy') : ''
              } - ${endDate ? format(new Date(endDate), 'MMM d, yyyy') : ''}`}
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
