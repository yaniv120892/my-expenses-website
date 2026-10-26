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
  COMPARISON_SCOPES,
  TrendPeriod,
  TransactionType,
  TrendFilters,
  MAX_COMPARISON_SERIES,
} from '@/types/trends';
import { Category } from '@/types';
import { useIsCompact } from '@/hooks/useBreakpoints';
import { seriesColor } from '@/utils/comparison';
import { isOneOf } from '@/utils/oneOf';
import { useState, useEffect } from 'react';
import { toDayString } from '@/shared/dates';
import { parseDayInput } from '@/utils/dateUtils';
import { useT } from '@/i18n/useT';
import { ALL_CATEGORIES } from './trendFilters';

const SELECTABLE_PERIODS: readonly TrendPeriod[] = [
  'weekly',
  'monthly',
  'yearly',
];

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
  const t = useT();
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
    setPeriod(event.target.value);
  };

  const handleStartDateChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const date = parseDayInput(event.target.value);
    if (date) {
      setStartDate(date);
    }
  };

  const handleEndDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const date = parseDayInput(event.target.value);
    if (date) {
      setEndDate(date);
    }
  };

  const handleCategoryChange = (event: SelectChangeEvent<string>) => {
    setSelectedCategory(event.target.value);
  };

  const handleTransactionTypeChange = (
    event: SelectChangeEvent<TransactionType>,
  ) => {
    setTransactionType(event.target.value);
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
        renderValue={(value, getItemProps) =>
          value.map((category, index) => {
            const { key, ...tagProps } = getItemProps({ index });
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
            label={t('trends.dialog.categoriesToCompare')}
            placeholder={isSelectionFull ? '' : t('trends.dialog.addCategory')}
          />
        )}
      />
      <FormControl fullWidth>
        <ToggleButtonGroup
          value={comparisonScope}
          exclusive
          size="small"
          onChange={(_, value) => {
            if (isOneOf(COMPARISON_SCOPES, value)) {
              setComparisonScope(value);
            }
          }}
          aria-label={t('trends.dialog.scopeLabel')}
        >
          <ToggleButton value="SUBTREE">
            {t('trends.dialog.scope.subtree')}
          </ToggleButton>
          <ToggleButton value="EXACT">
            {t('trends.dialog.scope.exact')}
          </ToggleButton>
        </ToggleButtonGroup>
        <FormHelperText>
          {comparisonScope === 'SUBTREE'
            ? t('trends.dialog.scope.subtreeHelp')
            : t('trends.dialog.scope.exactHelp')}
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
        {showComparisonFields
          ? t('trends.dialog.filterComparison')
          : t('trends.dialog.filterTrends')}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* Compare spans both types at once, so it has no Type filter. */}
          {!showComparisonFields && (
            <FormControl fullWidth>
              <InputLabel>{t('trends.dialog.type')}</InputLabel>
              <Select
                value={transactionType}
                label={t('trends.dialog.type')}
                onChange={handleTransactionTypeChange}
              >
                <MenuItem value="EXPENSE">{t('trends.type.expense')}</MenuItem>
                <MenuItem value="INCOME">{t('trends.type.income')}</MenuItem>
              </Select>
            </FormControl>
          )}

          <FormControl fullWidth>
            <InputLabel>{t('trends.dialog.period')}</InputLabel>
            <Select
              value={period}
              label={t('trends.dialog.period')}
              onChange={handlePeriodChange}
            >
              {SELECTABLE_PERIODS.map((option) => (
                <MenuItem key={option} value={option}>
                  {t(`trends.period.${option}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {showComparisonFields ? (
            comparisonFields
          ) : (
            <FormControl fullWidth>
              <InputLabel>{t('trends.dialog.category')}</InputLabel>
              <Select
                value={selectedCategory}
                label={t('trends.dialog.category')}
                onChange={handleCategoryChange}
              >
                <MenuItem value={ALL_CATEGORIES}>
                  {t('trends.allCategories')}
                </MenuItem>
                {sortedCategories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            label={t('trends.dialog.startDate')}
            type="date"
            value={toDayString(new Date(startDate))}
            onChange={handleStartDateChange}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <TextField
            label={t('trends.dialog.endDate')}
            type="date"
            value={toDayString(new Date(endDate))}
            onChange={handleEndDateChange}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('trends.dialog.cancel')}</Button>
        <Button variant="contained" onClick={handleApply}>
          {t('trends.dialog.apply')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
