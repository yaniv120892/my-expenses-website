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
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { TransactionFilters } from '@/types';
import { useIsCompact } from '@/hooks/useBreakpoints';
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setSearchTerm(initialFilters?.searchTerm || '');
      setCategoryId(initialFilters?.categoryId || '');
      setStartDate(initialFilters?.startDate || '');
      setEndDate(initialFilters?.endDate || '');
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
