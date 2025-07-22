import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  CircularProgress,
  Switch,
  FormControlLabel,
  Tooltip,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import { TransactionFilters } from "@/types";
import CategorySelect from "../CategorySelect";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [smartSearch, setSmartSearch] = useState(true);

  useEffect(() => {
    if (open) {
      setSearchTerm(initialFilters?.searchTerm || "");
      setCategoryId(initialFilters?.categoryId || "");
      setStartDate(initialFilters?.startDate || "");
      setEndDate(initialFilters?.endDate || "");
      setSmartSearch(
        initialFilters?.smartSearch !== undefined
          ? initialFilters.smartSearch
          : true
      );
    }
  }, [initialFilters, open]);

  const handleApply = async () => {
    setLoading(true);
    try {
      onApply({
        searchTerm: searchTerm.trim() === "" ? undefined : searchTerm,
        categoryId: categoryId === "" ? undefined : categoryId,
        startDate: startDate === "" ? undefined : startDate,
        endDate: endDate === "" ? undefined : endDate,
        smartSearch: searchTerm.trim() === "" ? undefined : smartSearch,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <FilterListIcon />
          Filter Transactions
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
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
                    disabled={searchTerm.trim() === ""}
                  />
                }
                label="Smart Search"
              />
            </span>
          </Tooltip>
          <CategorySelect
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
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
          disabled={loading}
        >
          {loading ? (
            <CircularProgress size={20} style={{ color: "#fff" }} />
          ) : (
            "Apply"
          )}
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
          disabled={loading}
        >
          Close
        </button>
      </DialogActions>
    </Dialog>
  );
};
