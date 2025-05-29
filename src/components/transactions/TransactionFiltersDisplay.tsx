import { Box, Chip, Button, Typography, Stack } from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import { TransactionFilters } from "@/types";
import { Category } from "@/types";
import dayjs from "dayjs";

interface TransactionFiltersDisplayProps extends TransactionFilters {
  onOpenFilters: () => void;
  categories: Category[];
  onResetSearch: () => void;
  onResetCategory: () => void;
  onResetDateRange: () => void;
}

export const TransactionFiltersDisplay = ({
  searchTerm,
  categoryId,
  startDate,
  endDate,
  onOpenFilters,
  categories,
  onResetSearch,
  onResetCategory,
  onResetDateRange,
}: TransactionFiltersDisplayProps) => {
  const hasActiveFilters = searchTerm || categoryId || startDate || endDate;

  const getCategoryName = (id: string) => {
    const category = categories.find((cat) => cat.id === id);
    return category ? category.name : id;
  };

  const chipSx = {
    backgroundColor: "var(--primary)",
    color: "var(--secondary)",
    fontWeight: "bold",
    "& .MuiChip-deleteIcon": {
      color: "var(--secondary)",
      "&:hover": {
        color: "var(--secondary)",
        opacity: 0.7,
      },
    },
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Typography variant="h4" color="var(--text-color)">
          Transactions
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

      {hasActiveFilters && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {searchTerm && (
            <Chip
              label={`Search: ${searchTerm}`}
              variant="outlined"
              onDelete={onResetSearch}
              sx={chipSx}
            />
          )}
          {categoryId && (
            <Chip
              label={`Category: ${getCategoryName(categoryId)}`}
              variant="outlined"
              onDelete={onResetCategory}
              sx={chipSx}
            />
          )}
          {(startDate || endDate) && (
            <Chip
              label={`Date: ${
                startDate ? dayjs(startDate).format("MMM D, YYYY") : ""
              } - ${endDate ? dayjs(endDate).format("MMM D, YYYY") : ""}`}
              variant="outlined"
              onDelete={onResetDateRange}
              sx={chipSx}
            />
          )}
        </Stack>
      )}
    </Box>
  );
};
