import { Box, Button, Typography, Chip, Stack } from "@mui/material";
import { TrendPeriod, TransactionType } from "@/types/trends";
import { Category } from "@/types";
import FilterListIcon from "@mui/icons-material/FilterList";
import dayjs from "dayjs";

interface TrendFiltersDisplayProps {
  period: TrendPeriod;
  startDate: Date;
  endDate: Date;
  selectedCategory: string;
  transactionType: TransactionType;
  categories: Category[];
  onOpenFilters: () => void;
}

export const TrendFiltersDisplay = ({
  period,
  startDate,
  endDate,
  selectedCategory,
  transactionType,
  categories,
  onOpenFilters,
}: TrendFiltersDisplayProps) => {
  const formatPeriod = (period: TrendPeriod) => {
    switch (period) {
      case "weekly":
        return "Weekly";
      case "monthly":
        return "Monthly";
      case "yearly":
        return "Yearly";
    }
  };

  const getCategoryName = () => {
    if (selectedCategory === "All Categories") return "All Categories";
    return categories.find((c) => c.id === selectedCategory)?.name || "";
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Typography variant="h4" color="var(--text-color)">
          {transactionType === "EXPENSE" ? "Spending" : "Income"} Trends
        </Typography>
        <Button
          variant="outlined"
          startIcon={<FilterListIcon />}
          onClick={onOpenFilters}
          size="small"
          sx={{
            backgroundColor: "var(--primary)",
            color: "var(--secondary)",
            fontWeight: "bold",
          }}
        >
          Filters
        </Button>
      </Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip
          label={`Type: ${
            transactionType === "EXPENSE" ? "Expenses" : "Income"
          }`}
          variant="outlined"
          sx={{
            backgroundColor: "var(--primary)",
            color: "var(--secondary)",
            fontWeight: "bold",
          }}
        />
        <Chip
          label={`Period: ${formatPeriod(period)}`}
          variant="outlined"
          sx={{
            backgroundColor: "var(--primary)",
            color: "var(--secondary)",
            fontWeight: "bold",
          }}
        />
        <Chip
          label={`Category: ${getCategoryName()}`}
          variant="outlined"
          sx={{
            backgroundColor: "var(--primary)",
            color: "var(--secondary)",
            fontWeight: "bold",
          }}
        />
        <Chip
          label={`From: ${dayjs(startDate).format("MMM D, YYYY")}`}
          variant="outlined"
          sx={{
            backgroundColor: "var(--primary)",
            color: "var(--secondary)",
            fontWeight: "bold",
          }}
        />
        <Chip
          label={`To: ${dayjs(endDate).format("MMM D, YYYY")}`}
          variant="outlined"
          sx={{
            backgroundColor: "var(--primary)",
            color: "var(--secondary)",
            fontWeight: "bold",
          }}
        />
      </Stack>
    </Box>
  );
};
