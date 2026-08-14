'use client';

import {
  Autocomplete,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  SelectChangeEvent,
  Box,
  useTheme,
} from '@mui/material';
import {
  ComparisonScope,
  TrendPeriod,
  TransactionType,
  TrendFilters,
  MAX_COMPARISON_SERIES,
} from '@/types/trends';
import { Category } from '@/types';
import { useIsCompact } from '@/hooks/useBreakpoints';
import { seriesColor } from '@/utils/comparison';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';

interface TrendFiltersDialogProps extends TrendFilters {
  open: boolean;
  onClose: () => void;
  onApply: (filters: TrendFilters) => void;
  categories: Category[];
  showComparisonFields: boolean;
}

export const TrendFiltersDialog = ({
  open,
  onClose,
  onApply,
  period: initialPeriod,
  startDate: initialStartDate,
  endDate: initialEndDate,
  selectedCategory: initialSelectedCategory,
  transactionType: initialTransactionType,
  comparisonCategoryIds: initialComparisonCategoryIds,
  comparisonScope: initialComparisonScope,
  categories,
  showComparisonFields,
}: TrendFiltersDialogProps) => {
  const fullScreen = useIsCompact();
  const theme = useTheme();
  const seriesColors = (theme.vars ?? theme).palette.charts.series;
  const [period, setPeriod] = useState(initialPeriod);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [selectedCategory, setSelectedCategory] = useState(
    initialSelectedCategory,
  );
  const [transactionType, setTransactionType] = useState(
    initialTransactionType,
  );
  const [comparisonCategoryIds, setComparisonCategoryIds] = useState(
    initialComparisonCategoryIds,
  );
  const [comparisonScope, setComparisonScope] = useState(
    initialComparisonScope,
  );

  useEffect(() => {
    if (open) {
      setPeriod(initialPeriod);
      setStartDate(initialStartDate);
      setEndDate(initialEndDate);
      setSelectedCategory(initialSelectedCategory);
      setTransactionType(initialTransactionType);
      setComparisonCategoryIds(initialComparisonCategoryIds);
      setComparisonScope(initialComparisonScope);
    }
  }, [
    open,
    initialPeriod,
    initialStartDate,
    initialEndDate,
    initialSelectedCategory,
    initialTransactionType,
    initialComparisonCategoryIds,
    initialComparisonScope,
  ]);

  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const selectedComparisonCategories = comparisonCategoryIds
    .map((id) => categoriesById.get(id))
    .filter((category): category is Category => Boolean(category));
  const isSelectionFull = comparisonCategoryIds.length >= MAX_COMPARISON_SERIES;

  const handlePeriodChange = (event: SelectChangeEvent<TrendPeriod>) => {
    setPeriod(event.target.value as TrendPeriod);
  };

  const handleStartDateChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setStartDate(new Date(event.target.value));
  };

  const handleEndDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(new Date(event.target.value));
  };

  const handleCategoryChange = (event: SelectChangeEvent<string>) => {
    setSelectedCategory(event.target.value);
  };

  const handleTransactionTypeChange = (
    event: SelectChangeEvent<TransactionType>,
  ) => {
    setTransactionType(event.target.value as TransactionType);
  };

  const handleApply = () => {
    onApply({
      period,
      startDate,
      endDate,
      selectedCategory,
      transactionType,
      comparisonCategoryIds,
      comparisonScope,
    });
  };

  const sortedCategories = [...categories].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const comparisonFields = (
    <>
      <Autocomplete
        multiple
        options={sortedCategories}
        value={selectedComparisonCategories}
        onChange={(_, value) =>
          setComparisonCategoryIds(value.map((category) => category.id))
        }
        getOptionLabel={(category) => category.name}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        getOptionDisabled={(option) =>
          isSelectionFull && !comparisonCategoryIds.includes(option.id)
        }
        limitTags={3}
        renderTags={(value, getTagProps) =>
          value.map((category, index) => {
            const { key, ...tagProps } = getTagProps({ index });
            return (
              <Chip
                {...tagProps}
                key={key}
                size="small"
                label={category.name}
                sx={{
                  borderLeft: 3,
                  borderColor: seriesColor(index, seriesColors),
                }}
              />
            );
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Categories to compare"
            placeholder={isSelectionFull ? '' : 'Add a category'}
          />
        )}
      />
      <FormControl fullWidth>
        <ToggleButtonGroup
          value={comparisonScope}
          exclusive
          size="small"
          onChange={(_, value) => {
            if (value) setComparisonScope(value as ComparisonScope);
          }}
          aria-label="Category scope"
        >
          <ToggleButton value="SUBTREE">Include subcategories</ToggleButton>
          <ToggleButton value="EXACT">This category only</ToggleButton>
        </ToggleButtonGroup>
        <FormHelperText>
          {comparisonScope === 'SUBTREE'
            ? 'A parent category sums all of its subcategories.'
            : 'Each category counts only its own transactions.'}
        </FormHelperText>
      </FormControl>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
    >
      <DialogTitle>
        {showComparisonFields ? 'Filter Comparison' : 'Filter Trends'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* Compare spans both types at once, so it has no Type filter. */}
          {!showComparisonFields && (
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={transactionType}
                label="Type"
                onChange={handleTransactionTypeChange}
              >
                <MenuItem value="EXPENSE">Expenses</MenuItem>
                <MenuItem value="INCOME">Income</MenuItem>
              </Select>
            </FormControl>
          )}

          <FormControl fullWidth>
            <InputLabel>Period</InputLabel>
            <Select value={period} label="Period" onChange={handlePeriodChange}>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="yearly">Yearly</MenuItem>
            </Select>
          </FormControl>

          {showComparisonFields ? (
            comparisonFields
          ) : (
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedCategory}
                label="Category"
                onChange={handleCategoryChange}
              >
                <MenuItem value="All Categories">All Categories</MenuItem>
                {sortedCategories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            label="Start Date"
            type="date"
            value={format(new Date(startDate), 'yyyy-MM-dd')}
            onChange={handleStartDateChange}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <TextField
            label="End Date"
            type="date"
            value={format(new Date(endDate), 'yyyy-MM-dd')}
            onChange={handleEndDateChange}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleApply}>
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
};
