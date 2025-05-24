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
import { CreateTransactionInput, Transaction } from "../types";
import dayjs from "dayjs";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import CategorySelect from "./CategorySelect";
import NotificationSnackbar from "./NotificationSnackbar";

type Props = {
  open: boolean;
  onCloseAction: () => void;
  onSubmitAction: (data: CreateTransactionInput) => Promise<void>;
  onDeleteAction?: (id: string) => Promise<void>;
  initialData?: Transaction | null;
};

type TransactionFormType = {
  description: string;
  value: number | string;
  categoryId: string;
  type: "EXPENSE" | "INCOME";
  date: string;
};

const defaultForm: TransactionFormType = {
  description: "",
  value: "",
  categoryId: "",
  type: "EXPENSE",
  date: dayjs().format("YYYY-MM-DD"),
};

export default function TransactionForm({
  open,
  onCloseAction,
  onSubmitAction,
  onDeleteAction,
  initialData,
}: Props) {
  const [form, setForm] = useState<TransactionFormType>(defaultForm);
  const [isLoadingUpdate, setIsLoadingUpdate] = useState(false);
  const [isLoadingDelete, setIsLoadingDelete] = useState(false);
  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">(
    "success"
  );

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
    if (!form.description) {
      errs.description = "Description is required";
    }
    if (isNaN(Number(form.value))) {
      errs.value = "Value must be a number";
    } else {
      if (Number(form.value) <= 0) {
        errs.value = "Value must be greater than 0";
      }
    }
    if (!form.type) {
      errs.type = "Type is required";
    }
    if (!form.date) {
      errs.date = "Date is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const getCurrentDateTimeString = () => {
    return dayjs().format("YYYY-MM-DDTHH:mm:ss");
  };

  const showSnackbar = (
    message: string,
    severity: "success" | "error" = "success"
  ) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }
    setIsLoadingUpdate(true);
    try {
      let dateToUse = form.date;
      if (!initialData) {
        const today = dayjs().format("YYYY-MM-DD");
        if (form.date === today) {
          dateToUse = getCurrentDateTimeString();
        }
      }
      const submitData = {
        ...form,
        value: Number(form.value),
        categoryId: form.categoryId === "" ? undefined : form.categoryId,
        date: dateToUse,
      };
      await onSubmitAction(submitData);
      showSnackbar(
        initialData
          ? "Transaction updated successfully"
          : "Transaction created successfully",
        "success"
      );
      onCloseAction();
    } catch {
      showSnackbar("Failed to save transaction", "error");
    } finally {
      setIsLoadingUpdate(false);
    }
  };

  async function handleDelete() {
    if (initialData && onDeleteAction) {
      setIsLoadingDelete(true);
      try {
        await onDeleteAction(initialData.id);
        showSnackbar("Transaction deleted successfully", "success");
        onCloseAction();
      } catch {
        showSnackbar("Failed to delete transaction", "error");
      } finally {
        setIsLoadingDelete(false);
      }
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={isLoadingUpdate || isLoadingDelete ? undefined : onCloseAction}
        fullWidth
        disableEscapeKeyDown={isLoadingUpdate || isLoadingDelete}
      >
        <DialogTitle
          style={{
            fontWeight: 700,
            color: "black",
          }}
        >
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
            <CategorySelect
              value={form.categoryId}
              onChange={handleChange}
              error={!!errors.categoryId}
              helperText={errors.categoryId}
              label="Category"
              fullWidth
            />
            {form.categoryId === "" && (
              <Box sx={{ color: "orange", fontSize: 13, mt: -1, mb: 1 }}>
                If category is not filled, it will be generated by AI.
              </Box>
            )}
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
              onClick={handleSubmit}
              disabled={isLoadingUpdate || isLoadingDelete}
            >
              {isLoadingUpdate ? (
                <>
                  <CircularProgress size={20} style={{ color: "#fff" }} />
                  {initialData ? "Update" : "Create"}
                </>
              ) : (
                <>
                  <SaveIcon style={{ fontSize: 20 }} />
                  {initialData ? "Update" : "Create"}
                </>
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
              onClick={onCloseAction}
              disabled={isLoadingUpdate || isLoadingDelete}
            >
              <CloseIcon style={{ fontSize: 20 }} />
              Close
            </button>
          </Box>
          {initialData && (
            <button
              className="button-secondary"
              style={{
                width: "100%",
                color: "#fff",
                background: "#e74c3c",
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
              onClick={handleDelete}
              disabled={isLoadingUpdate || isLoadingDelete}
            >
              {isLoadingDelete ? (
                <>
                  <CircularProgress size={20} style={{ color: "#fff" }} />
                  {"Delete"}
                </>
              ) : (
                <>
                  <DeleteIcon style={{ fontSize: 20 }} />
                  {"Delete"}
                </>
              )}
            </button>
          )}
        </DialogActions>
      </Dialog>
      <NotificationSnackbar
        open={snackbarOpen}
        message={snackbarMessage}
        severity={snackbarSeverity}
        onClose={() => setSnackbarOpen(false)}
      />
    </>
  );
}
