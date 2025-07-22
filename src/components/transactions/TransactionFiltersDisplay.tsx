import { Box, Chip, Button, Typography, Stack, Tooltip } from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { TransactionFilters } from "@/types";
import { Category } from "@/types";
import dayjs from "dayjs";

interface TransactionFiltersDisplayProps extends TransactionFilters {
  onOpenFilters: () => void;
  categories: Category[];
  onResetSearch: () => void;
  onResetCategory: () => void;
  onResetDateRange: () => void;
  smartSearch?: boolean;
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
  smartSearch,
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
        <Box
          sx={{ cursor: "pointer", "&:hover": { opacity: 0.85 } }}
          onClick={onOpenFilters}
        >
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {searchTerm && (
              <Chip
                label={
                  <Box
                    component="span"
                    display="flex"
                    alignItems="center"
                    gap={0.5}
                  >
                    {smartSearch && (
                      <Tooltip title="Smart Search is enabled (typo-tolerant, flexible search)">
                        <AutoFixHighIcon
                          color="primary"
                          fontSize="small"
                          style={{ verticalAlign: "middle" }}
                        />
                      </Tooltip>
                    )}
                    <span>{`Search: ${searchTerm}`}</span>
                  </Box>
                }
                variant="outlined"
                onDelete={(e) => {
                  e.stopPropagation();
                  onResetSearch();
                }}
                sx={chipSx}
              />
            )}
            {categoryId && (
              <Chip
                label={`Category: ${getCategoryName(categoryId)}`}
                variant="outlined"
                onDelete={(e) => {
                  e.stopPropagation();
                  onResetCategory();
                }}
                sx={chipSx}
              />
            )}
            {(startDate || endDate) && (
              <Chip
                label={`Date: ${
                  startDate ? dayjs(startDate).format("MMM D, YYYY") : ""
                } - ${endDate ? dayjs(endDate).format("MMM D, YYYY") : ""}`}
                variant="outlined"
                onDelete={(e) => {
                  e.stopPropagation();
                  onResetDateRange();
                }}
                sx={chipSx}
              />
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );
};
