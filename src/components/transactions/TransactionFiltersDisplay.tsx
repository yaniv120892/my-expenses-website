import { Box, Chip, Button, Typography } from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import { TransactionFilters } from "@/types";
import dayjs from "dayjs";

interface TransactionFiltersDisplayProps extends TransactionFilters {
  onOpenFilters: () => void;
}

export const TransactionFiltersDisplay = ({
  searchTerm,
  categoryId,
  startDate,
  endDate,
  onOpenFilters,
}: TransactionFiltersDisplayProps) => {
  const hasActiveFilters = searchTerm || categoryId || startDate || endDate;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
      <Typography variant="h4" color="var(--text-color)">
        Transactions
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
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
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
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
              label={`Category: ${categoryId}`}
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
        </Box>
      )}
    </Box>
  );
};
