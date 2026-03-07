"use client";

import React, { useState } from "react";
import {
  Snackbar,
  Alert,
  Button,
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import CategorySelect from "./CategorySelect";
import { useUpdateTransactionMutation } from "../hooks/useTransactionsQuery";
import { UpdateTransactionInput } from "../types";

interface CategoryConfirmationSnackbarProps {
  open: boolean;
  transactionId: string;
  description: string;
  suggestedCategory: { id: string; name: string };
  onClose: () => void;
}

export default function CategoryConfirmationSnackbar({
  open,
  transactionId,
  description,
  suggestedCategory,
  onClose,
}: CategoryConfirmationSnackbarProps) {
  const [changingCategory, setChangingCategory] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    suggestedCategory.id
  );
  const updateMutation = useUpdateTransactionMutation();

  const handleChange = () => {
    setSelectedCategoryId(suggestedCategory.id);
    setChangingCategory(true);
  };

  const handleSave = async () => {
    if (selectedCategoryId && selectedCategoryId !== suggestedCategory.id) {
      await updateMutation.mutateAsync({
        id: transactionId,
        data: { categoryId: selectedCategoryId } as UpdateTransactionInput,
      });
    }
    setChangingCategory(false);
    onClose();
  };

  const handleDialogClose = () => {
    setChangingCategory(false);
  };

  const truncatedDescription =
    description.length > 30 ? description.slice(0, 30) + "..." : description;

  return (
    <>
      <Snackbar
        open={open && !changingCategory}
        autoHideDuration={10000}
        onClose={onClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="info"
          variant="filled"
          onClose={onClose}
          action={
            <Button color="inherit" size="small" onClick={handleChange}>
              Change
            </Button>
          }
          sx={{ width: "100%", alignItems: "center" }}
        >
          <Typography variant="body2">
            Category for &quot;{truncatedDescription}&quot;:{" "}
            <strong>{suggestedCategory.name}</strong>
          </Typography>
        </Alert>
      </Snackbar>

      <Dialog
        open={changingCategory}
        onClose={handleDialogClose}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Change Category</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ mb: 2 }}>
              &quot;{description}&quot;
            </Typography>
            <CategorySelect
              value={selectedCategoryId}
              onChange={setSelectedCategoryId}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} variant="outlined">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={updateMutation.isPending}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
