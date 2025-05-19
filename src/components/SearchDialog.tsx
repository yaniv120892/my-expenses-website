import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  CircularProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { TransactionFilters } from "../types";
import CategorySelect from "./CategorySelect";

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
  const [loading, setLoading] = useState(false);

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
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      fullWidth
      sx={{ mt: 8 }}
    >
      <DialogTitle style={{ fontWeight: 700, color: "var(--primary)" }}>
        <Box display="flex" alignItems="center" gap={1}>
          <SearchIcon style={{ color: "var(--primary)" }} />
          Search Transactions
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
      <DialogActions
        style={{ padding: "1.5rem", flexDirection: "column", gap: 12 }}
      >
        <Box display="flex" width="100%" gap={2}>
          <button
            className="button-secondary"
            style={{
              width: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <CircularProgress size={20} style={{ color: "#fff" }} />
            ) : (
              "Search"
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
        </Box>
      </DialogActions>
    </Dialog>
  );
}
