'use client';

import React, { useState } from 'react';
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
} from '@mui/material';
import CategorySelect from './CategorySelect';
import { useUpdateTransactionMutation } from '../hooks/useTransactionsQuery';
import { CreateTransactionInput } from '../types';

type CategoryConfirmationSnackbarProps = {
  open: boolean;
  transactionId: string;
  // The update endpoint replaces the whole row, so the created input is resent.
  transactionInput: CreateTransactionInput;
  suggestedCategory: { id: string; name: string };
  onClose: () => void;
};

export default function CategoryConfirmationSnackbar({
  open,
  transactionId,
  transactionInput,
  suggestedCategory,
  onClose,
}: CategoryConfirmationSnackbarProps) {
  const [changingCategory, setChangingCategory] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    suggestedCategory.id,
  );
  const updateMutation = useUpdateTransactionMutation();
  const { description } = transactionInput;

  const handleChange = () => {
    setSelectedCategoryId(suggestedCategory.id);
    updateMutation.reset();
    setChangingCategory(true);
  };

  const handleSave = async () => {
    if (selectedCategoryId && selectedCategoryId !== suggestedCategory.id) {
      try {
        await updateMutation.mutateAsync({
          id: transactionId,
          data: { ...transactionInput, categoryId: selectedCategoryId },
        });
      } catch {
        return;
      }
    }
    setChangingCategory(false);
    onClose();
  };

  const handleDialogClose = () => {
    setChangingCategory(false);
  };

  const truncatedDescription =
    description.length > 30 ? description.slice(0, 30) + '...' : description;

  return (
    <>
      <Snackbar
        open={open && !changingCategory}
        autoHideDuration={10000}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
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
          sx={{ width: '100%', alignItems: 'center' }}
        >
          <Typography variant="body2">
            Category for &quot;{truncatedDescription}&quot;:{' '}
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
            {updateMutation.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : 'Failed to update category'}
              </Alert>
            )}
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
