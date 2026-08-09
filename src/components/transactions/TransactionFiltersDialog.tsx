'use client';

import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Stack,
  Switch,
  FormControlLabel,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { TransactionFilters } from '@/types';
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
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [smartSearch, setSmartSearch] = useState(true);

  useEffect(() => {
    if (open) {
      setSearchTerm(initialFilters?.searchTerm || '');
      setCategoryId(initialFilters?.categoryId || '');
      setStartDate(initialFilters?.startDate || '');
      setEndDate(initialFilters?.endDate || '');
      setSmartSearch(
        initialFilters?.smartSearch !== undefined
          ? initialFilters.smartSearch
          : true,
      );
    }
  }, [initialFilters, open]);

  const handleApply = async () => {
    setLoading(true);
    try {
      onApply({
        searchTerm: searchTerm.trim() === '' ? undefined : searchTerm,
        categoryId: categoryId === '' ? undefined : categoryId,
        startDate: startDate === '' ? undefined : startDate,
        endDate: endDate === '' ? undefined : endDate,
        smartSearch: searchTerm.trim() === '' ? undefined : smartSearch,
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
          <TextField
            label="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            fullWidth
          />
          <Tooltip
            title="Enable typo-tolerant, flexible search. Disable for strict exact/substring match."
            placement="right"
          >
            <span>
              <FormControlLabel
                control={
                  <Switch
                    checked={smartSearch}
                    onChange={(_, checked) => setSmartSearch(checked)}
                    color="primary"
                    disabled={searchTerm.trim() === ''}
                  />
                }
                label="Smart Search"
              />
            </span>
          </Tooltip>
          <CategorySelect
            value={categoryId}
            onChange={(value) => setCategoryId(value)}
            label="Category"
            fullWidth
          />
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
