"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from "@mui/material";
import { Category, CreateTransactionInput, Transaction } from "../types";
import { getCategories } from "../services/transactions";
import dayjs from "dayjs";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTransactionInput) => Promise<void>;
  initialData?: Transaction | null;
};

const defaultForm: Omit<CreateTransactionInput, "date"> = {
  description: "",
  value: 0,
  categoryId: "",
  type: "EXPENSE",
};

export default function TransactionForm({
  open,
  onClose,
  onSubmit,
  initialData,
}: Props) {
  const [form, setForm] = useState<CreateTransactionInput>({
    ...defaultForm,
    date: dayjs().format("YYYY-MM-DD"),
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [k: string]: string }>({});

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (initialData) {
      setForm({
        description: initialData.description,
        value: initialData.value,
        categoryId: initialData.category.id,
        type: initialData.type,
        date: dayjs(initialData.date).format("YYYY-MM-DD"),
      });
    } else {
      setForm({
        ...defaultForm,
        date: dayjs().format("YYYY-MM-DD"),
      });
    }
    setErrors({});
  }, [initialData, open]);

  const validate = () => {
    const errs: { [k: string]: string } = {};
    if (!form.description) errs.description = "Description is required";
    if (!form.value || form.value <= 0)
      errs.value = "Value must be greater than 0";
    if (!form.categoryId) errs.categoryId = "Category is required";
    if (!form.type) errs.type = "Type is required";
    if (!form.date) errs.date = "Date is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await onSubmit(form);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle style={{ fontWeight: 700, color: "var(--primary)" }}>
        {initialData ? "Edit Transaction" : "New Transaction"}
      </DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          <TextField
            label="Description"
            name="description"
            value={form.description}
            onChange={handleChange}
            error={!!errors.description}
            helperText={errors.description}
            fullWidth
          />
          <TextField
            label="Value"
            name="value"
            type="number"
            value={form.value}
            onChange={handleChange}
            error={!!errors.value}
            helperText={errors.value}
            fullWidth
          />
          <TextField
            select
            label="Category"
            name="categoryId"
            value={form.categoryId}
            onChange={handleChange}
            error={!!errors.categoryId}
            helperText={errors.categoryId}
            fullWidth
          >
            {categories.map((cat) => (
              <MenuItem key={cat.id} value={cat.id}>
                {cat.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Type"
            name="type"
            value={form.type}
            onChange={handleChange}
            error={!!errors.type}
            helperText={errors.type}
            fullWidth
          >
            <MenuItem value="EXPENSE">Expense</MenuItem>
            <MenuItem value="INCOME">Income</MenuItem>
          </TextField>
          <TextField
            label="Date"
            name="date"
            type="date"
            value={form.date}
            onChange={handleChange}
            error={!!errors.date}
            helperText={errors.date}
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
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <CircularProgress size={20} style={{ color: "#fff" }} />
          ) : initialData ? (
            "Update"
          ) : (
            "Create"
          )}
        </button>
      </DialogActions>
    </Dialog>
  );
}
