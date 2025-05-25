import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  SelectChangeEvent,
} from "@mui/material";
import { TrendPeriod, TransactionType } from "@/types/trends";
import { Category } from "@/types";
import dayjs from "dayjs";

interface TrendFiltersProps {
  period: TrendPeriod;
  startDate: Date;
  endDate: Date;
  selectedCategory: string;
  transactionType: TransactionType;
  categories: Category[];
  onPeriodChange: (event: SelectChangeEvent<TrendPeriod>) => void;
  onStartDateChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onEndDateChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onCategoryChange: (event: SelectChangeEvent<string>) => void;
  onTransactionTypeChange: (event: SelectChangeEvent<TransactionType>) => void;
}

export const TrendFilters = ({
  period,
  startDate,
  endDate,
  selectedCategory,
  transactionType,
  categories,
  onPeriodChange,
  onStartDateChange,
  onEndDateChange,
  onCategoryChange,
  onTransactionTypeChange,
}: TrendFiltersProps) => {
  return (
    <Box sx={{ display: "flex", gap: 3, mb: 4, flexWrap: "wrap" }}>
      <Box sx={{ flex: "1 1 300px", minWidth: 0 }}>
        <FormControl fullWidth>
          <InputLabel>Type</InputLabel>
          <Select
            value={transactionType}
            label="Type"
            onChange={onTransactionTypeChange}
          >
            <MenuItem value="EXPENSE">Expenses</MenuItem>
            <MenuItem value="INCOME">Income</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <Box sx={{ flex: "1 1 300px", minWidth: 0 }}>
        <FormControl fullWidth>
          <InputLabel>Period</InputLabel>
          <Select value={period} label="Period" onChange={onPeriodChange}>
            <MenuItem value="weekly">Weekly</MenuItem>
            <MenuItem value="monthly">Monthly</MenuItem>
            <MenuItem value="yearly">Yearly</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <Box sx={{ flex: "1 1 300px", minWidth: 0 }}>
        <FormControl fullWidth>
          <InputLabel>Category</InputLabel>
          <Select
            value={selectedCategory}
            label="Category"
            onChange={onCategoryChange}
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
      </Box>
      <Box sx={{ flex: "1 1 300px", minWidth: 0 }}>
        <TextField
          label="Start Date"
          type="date"
          value={dayjs(startDate).format("YYYY-MM-DD")}
          onChange={onStartDateChange}
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>
      <Box sx={{ flex: "1 1 300px", minWidth: 0 }}>
        <TextField
          label="End Date"
          type="date"
          value={dayjs(endDate).format("YYYY-MM-DD")}
          onChange={onEndDateChange}
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>
    </Box>
  );
};
