'use client';

import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  SelectChangeEvent,
  Box,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { TrendPeriod, TransactionType, TrendFilters } from '@/types/trends';
import { Category } from '@/types';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';

interface TrendFiltersDialogProps extends Omit<
  TrendFilters,
  'period' | 'startDate' | 'endDate' | 'selectedCategory' | 'transactionType'
> {
  open: boolean;
  onClose: () => void;
  onApply: (filters: TrendFilters) => void;
  period: TrendPeriod;
  startDate: Date;
  endDate: Date;
  selectedCategory: string;
  transactionType: TransactionType;
  categories: Category[];
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
  categories,
}: TrendFiltersDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [period, setPeriod] = useState(initialPeriod);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [selectedCategory, setSelectedCategory] = useState(
    initialSelectedCategory,
  );
  const [transactionType, setTransactionType] = useState(
    initialTransactionType,
  );

  useEffect(() => {
    if (open) {
      setPeriod(initialPeriod);
      setStartDate(initialStartDate);
      setEndDate(initialEndDate);
      setSelectedCategory(initialSelectedCategory);
      setTransactionType(initialTransactionType);
    }
  }, [
    open,
    initialPeriod,
    initialStartDate,
    initialEndDate,
    initialSelectedCategory,
    initialTransactionType,
  ]);

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
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
    >
      <DialogTitle>Filter Trends</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
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

          <FormControl fullWidth>
            <InputLabel>Period</InputLabel>
            <Select value={period} label="Period" onChange={handlePeriodChange}>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="yearly">Yearly</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={selectedCategory}
              label="Category"
              onChange={handleCategoryChange}
            >
              <MenuItem value="All Categories">All Categories</MenuItem>
              {categories
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

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
