import { Box, Chip, Button, Typography, Stack } from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import { TransactionFilters } from "@/types";
import { Category } from "@/types";
import dayjs from "dayjs";

interface TransactionFiltersDisplayProps extends TransactionFilters {
  onOpenFilters: () => void;
  categories: Category[];
}

export const TransactionFiltersDisplay = ({
  searchTerm,
  categoryId,
  startDate,
  endDate,
  onOpenFilters,
  categories,
}: TransactionFiltersDisplayProps) => {
  const hasActiveFilters = searchTerm || categoryId || startDate || endDate;

  const getCategoryName = (id: string) => {
    const category = categories.find((cat) => cat.id === id);
    return category ? category.name : id;
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
              sx={{
                backgroundColor: "var(--primary)",
                color: "var(--secondary)",
                fontWeight: "bold",
              }}
            />
          )}
          {categoryId && (
            <Chip
              label={`Category: ${getCategoryName(categoryId)}`}
              variant="outlined"
              sx={{
                backgroundColor: "var(--primary)",
                color: "var(--secondary)",
                fontWeight: "bold",
              }}
            />
          )}
          {startDate && (
            <Chip
              label={`From: ${dayjs(startDate).format("MMM D, YYYY")}`}
              variant="outlined"
              sx={{
                backgroundColor: "var(--primary)",
                color: "var(--secondary)",
                fontWeight: "bold",
              }}
            />
          )}
          {endDate && (
            <Chip
              label={`To: ${dayjs(endDate).format("MMM D, YYYY")}`}
              variant="outlined"
              sx={{
                backgroundColor: "var(--primary)",
                color: "var(--secondary)",
                fontWeight: "bold",
              }}
            />
          )}
        </Stack>
      )}
    </Box>
  );
};
