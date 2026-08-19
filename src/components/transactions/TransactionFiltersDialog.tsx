'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { TransactionFilters, TransactionType } from '@/types';
import { useIsCompact } from '@/hooks/useBreakpoints';
import {
  DATE_RANGE_PRESETS,
  matchDateRangePreset,
} from '@/utils/dateRangePresets';
import CategorySelect from '../CategorySelect';

interface TransactionFiltersDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (filters: TransactionFilters) => void;
  initialFilters?: TransactionFilters;
}

export const TransactionFiltersDialog = ({
  open,
  onClose,
  onApply,
  initialFilters,
}: TransactionFiltersDialogProps) => {
  const fullScreen = useIsCompact();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<TransactionType | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setSearchTerm(initialFilters?.searchTerm || '');
      setCategoryId(initialFilters?.categoryId || '');
      setType(initialFilters?.type || '');
      setStartDate(initialFilters?.startDate || '');
      setEndDate(initialFilters?.endDate || '');
    }
  }, [initialFilters, open]);

  // Recomputed per render rather than tracked as state: the date fields stay
  // editable by hand, and typing a range that happens to match a preset should
  // light that chip up.
  const activePreset = useMemo(
    () =>
      matchDateRangePreset(
        {
          startDate: startDate === '' ? undefined : startDate,
          endDate: endDate === '' ? undefined : endDate,
        },
        new Date(),
      ),
    [startDate, endDate],
  );

  const handleApply = async () => {
    setLoading(true);
    try {
      onApply({
        searchTerm: searchTerm.trim() === '' ? undefined : searchTerm,
        categoryId: categoryId === '' ? undefined : categoryId,
        type: type === '' ? undefined : type,
        startDate: startDate === '' ? undefined : startDate,
        endDate: endDate === '' ? undefined : endDate,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      fullWidth
      fullScreen={fullScreen}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <FilterListIcon />
          <span>Filter Transactions</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary">
              Date range
            </Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
              {DATE_RANGE_PRESETS.map((preset) => (
                <Chip
                  key={preset.id}
                  label={preset.label}
                  size="small"
                  color={activePreset === preset.id ? 'primary' : 'default'}
                  variant={activePreset === preset.id ? 'filled' : 'outlined'}
                  onClick={() => {
                    const range = preset.range(new Date());
                    setStartDate(range.startDate ?? '');
                    setEndDate(range.endDate ?? '');
                  }}
                />
              ))}
            </Stack>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary">
              Type
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={type}
              onChange={(_, next: TransactionType | '' | null) =>
                setType(next ?? '')
              }
            >
              <ToggleButton value="">Any</ToggleButton>
              <ToggleButton value="INCOME">Income</ToggleButton>
              <ToggleButton value="EXPENSE">Expense</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <TextField
            label="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            fullWidth
          />
          <CategorySelect
            value={categoryId}
            onChange={(value) => setCategoryId(value)}
            label="Category"
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
        <Button variant="outlined" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleApply}
          disabled={loading}
          startIcon={
            loading ? <CircularProgress size={18} color="inherit" /> : undefined
          }
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
};
