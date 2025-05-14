import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Box,
  CircularProgress,
} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import { Category, TransactionFilters } from "../types";
import { getCategories } from "../services/transactions";

type SearchDialogProps = {
  open: boolean;
  onClose: () => void;
  onSearch: (filters: TransactionFilters) => void;
  initialFilters?: TransactionFilters;
};

export default function SearchDialog({
  open,
  onClose,
  onSearch,
  initialFilters,
}: SearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    setSearchTerm(initialFilters?.searchTerm || "");
    setCategoryId(initialFilters?.categoryId || "");
    setStartDate(initialFilters?.startDate || "");
    setEndDate(initialFilters?.endDate || "");
  }, [initialFilters, open]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      onSearch({
        searchTerm: searchTerm.trim() === "" ? undefined : searchTerm,
        categoryId: categoryId === "" ? undefined : categoryId,
        startDate: startDate === "" ? undefined : startDate,
        endDate: endDate === "" ? undefined : endDate,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth sx={{ mt: 8 }}>
      <DialogTitle style={{ fontWeight: 700, color: "var(--primary)" }}>
        <Box display="flex" alignItems="center" gap={1}>
          <SearchIcon style={{ color: "var(--primary)" }} />
          Search Transactions
          <IconButton size="small" sx={{ ml: 1 }}>
            <AddIcon style={{ color: "#2ecc40" }} />
          </IconButton>
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
          <TextField
            select
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            fullWidth
          >
            <MenuItem value="">All</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat.id} value={cat.id}>
                {cat.name}
              </MenuItem>
            ))}
          </TextField>
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
      <DialogActions style={{ padding: "1.5rem" }}>
        <button
          className="button-secondary"
          style={{ minWidth: 100 }}
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          className="button-primary"
          style={{ minWidth: 120 }}
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? (
            <CircularProgress size={20} style={{ color: "#fff" }} />
          ) : (
            "Search"
          )}
        </button>
      </DialogActions>
    </Dialog>
  );
}
