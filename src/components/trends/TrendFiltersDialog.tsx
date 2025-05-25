import {
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
} from "@mui/material";
import { TrendPeriod, TransactionType, TrendFilters } from "@/types/trends";
import { Category } from "@/types";
import dayjs from "dayjs";
import { useState, useEffect } from "react";

interface TrendFiltersDialogProps
  extends Omit<
    TrendFilters,
    "period" | "startDate" | "endDate" | "selectedCategory" | "transactionType"
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
  const [period, setPeriod] = useState(initialPeriod);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [selectedCategory, setSelectedCategory] = useState(
    initialSelectedCategory
  );
  const [transactionType, setTransactionType] = useState(
    initialTransactionType
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
    event: React.ChangeEvent<HTMLInputElement>
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
    event: SelectChangeEvent<TransactionType>
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Filter Trends</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
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
            value={dayjs(startDate).format("YYYY-MM-DD")}
            onChange={handleStartDateChange}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <TextField
            label="End Date"
            type="date"
            value={dayjs(endDate).format("YYYY-MM-DD")}
            onChange={handleEndDateChange}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, display: "flex", gap: 2 }}>
        <button
          className="button-secondary"
          style={{
            width: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          onClick={handleApply}
        >
          Apply
        </button>
        <button
          className="button-primary"
          style={{
            width: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          onClick={onClose}
        >
          Close
        </button>
      </DialogActions>
    </Dialog>
  );
};
