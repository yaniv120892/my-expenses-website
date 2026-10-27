'use client';

import React, { useEffect, useState } from 'react';
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
import type { TransactionFilters, TransactionType } from '@/types';
import { useIsCompact } from '@/hooks/useBreakpoints';
import { DATE_RANGE_PRESETS, matchDateRangePreset } from '@/utils/dateRangePresets';
import CategorySelect from '../CategorySelect';
import { useT } from '@/i18n/useT';

type TransactionFiltersDialogProps = {
  open: boolean;
  onClose: () => void;
  onApply: (filters: TransactionFilters) => void;
  initialFilters?: TransactionFilters;
};

export const TransactionFiltersDialog = ({
  open,
  onClose,
  onApply,
  initialFilters,
}: TransactionFiltersDialogProps) => {
  const t = useT();
  const fullScreen = useIsCompact();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<TransactionType | undefined>();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setSearchTerm(initialFilters?.searchTerm || '');
      setCategoryId(initialFilters?.categoryId || '');
      setType(initialFilters?.type);
      setStartDate(initialFilters?.startDate || '');
      setEndDate(initialFilters?.endDate || '');
    }
  }, [initialFilters, open]);

  // One clock for the whole render, so every chip is measured against it.
  const now = new Date();
  const filters: TransactionFilters = {
    searchTerm: searchTerm.trim() || undefined,
    categoryId: categoryId || undefined,
    type,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  const activePreset = matchDateRangePreset(filters, now);

  const handleApply = async () => {
    setLoading(true);
    try {
      onApply(filters);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth fullScreen={fullScreen}>
      <DialogTitle>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
          }}
        >
          <FilterListIcon />
          <span>{t('transactions.filters.title')}</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack spacing={1}>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t('transactions.filters.dateRange')}
            </Typography>
            <Stack
              direction="row"
              useFlexGap
              spacing={1}
              sx={{
                flexWrap: 'wrap',
              }}
            >
              {DATE_RANGE_PRESETS.map((preset) => (
                <Chip
                  key={preset.id}
                  label={t(`transactions.datePreset.${preset.id}`)}
                  size="small"
                  color={activePreset === preset.id ? 'primary' : 'default'}
                  variant={activePreset === preset.id ? 'filled' : 'outlined'}
                  onClick={() => {
                    const range = preset.range(now);
                    setStartDate(range.startDate ?? '');
                    setEndDate(range.endDate ?? '');
                  }}
                />
              ))}
            </Stack>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label={t('transactions.filters.startDate')}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              fullWidth
              slotProps={{
                inputLabel: { shrink: true },
              }}
            />
            <TextField
              label={t('transactions.filters.endDate')}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              fullWidth
              slotProps={{
                inputLabel: { shrink: true },
              }}
            />
          </Stack>

          <Stack spacing={1}>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t('common.type')}
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={type ?? ''}
              onChange={(_, next: TransactionType | '' | null) => setType(next || undefined)}
            >
              <ToggleButton value="">{t('transactions.filters.any')}</ToggleButton>
              <ToggleButton value="INCOME">{t('common.income')}</ToggleButton>
              <ToggleButton value="EXPENSE">{t('common.expense')}</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <TextField
            label={t('common.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            fullWidth
          />
          <CategorySelect
            value={categoryId}
            onChange={(value) => setCategoryId(value)}
            label={t('common.category')}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
        <Button variant="outlined" onClick={onClose} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleApply}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          {t('common.apply')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
