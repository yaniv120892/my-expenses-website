'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { CreateTransactionInput } from '../types';
import { format } from 'date-fns';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import { useIsCompact } from '../hooks/useBreakpoints';
import CategorySelect from './CategorySelect';
import NotificationSnackbar from './NotificationSnackbar';
import TransactionAttachments from './TransactionForm/TransactionAttachments';
import {
  useRemoveFileMutation,
  useDirectS3UploadForAttachment,
} from '@/hooks/useTransactionFilesQuery';
import { validateTransactionForm } from '@/utils/transactionFormValidation';

type TransactionFormType = {
  id: string;
  description: string;
  value: number | string;
  categoryId: string;
  type: 'EXPENSE' | 'INCOME';
  date: string;
};

type Props = {
  open: boolean;
  onCloseAction: () => void;
  onSubmitAction: (data: CreateTransactionInput) => Promise<string | void>;
  onDeleteAction?: (id: string) => Promise<void>;
  initialData?: TransactionFormType | null;
  mode?: 'approve' | 'merge';
};

const defaultForm: TransactionFormType = {
  id: '',
  description: '',
  value: '',
  categoryId: '',
  type: 'EXPENSE',
  date: format(new Date(), 'yyyy-MM-dd'),
};

export default function TransactionForm({
  open,
  onCloseAction,
  onSubmitAction,
  onDeleteAction,
  initialData,
  mode,
}: Props) {
  const fullScreen = useIsCompact();
  const [form, setForm] = useState<TransactionFormType>(defaultForm);
  const [isLoadingUpdate, setIsLoadingUpdate] = useState(false);
  const [isLoadingDelete, setIsLoadingDelete] = useState(false);
  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>(
    'success',
  );
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [filesToRemove, setFilesToRemove] = useState<string[]>([]);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);

  const directS3Upload = useDirectS3UploadForAttachment();
  const removeFileMutation = useRemoveFileMutation(initialData?.id || '');

  useEffect(() => {
    if (initialData) {
      setForm({
        id: initialData.id,
        description: initialData.description,
        value: initialData.value,
        categoryId: initialData.categoryId || '',
        type: initialData.type,
        date: format(new Date(initialData.date), 'yyyy-MM-dd'),
      });
    } else {
      setForm({
        ...defaultForm,
        date: format(new Date(), 'yyyy-MM-dd'),
      });
    }
    setErrors({});
  }, [initialData, open]);

  // Which endpoint this submit hits decides the rule: merge and update need a
  // uuid, while create and import-approve let the server categorize.
  const requireCategory = mode === 'merge' || (!mode && Boolean(initialData));

  const validate = () => {
    const errs = validateTransactionForm(form, requireCategory);
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const getCurrentDateTimeString = () => {
    return format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");
  };

  const showSnackbar = (
    message: string,
    severity: 'success' | 'error' = 'success',
  ) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleUploadError = (err: unknown) => {
    let message = 'Direct S3 upload failed.';
    if (err instanceof Error) {
      message += ` Error: ${err.message}`;
    } else if (typeof err === 'string') {
      message += ` Error: ${err}`;
    }
    setFileUploadError(message);
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }
    setIsLoadingUpdate(true);
    setFileUploadError(null);
    try {
      let dateToUse = form.date;
      if (!initialData) {
        const today = format(new Date(), 'yyyy-MM-dd');
        if (form.date === today) {
          dateToUse = getCurrentDateTimeString();
        }
      }
      const submitData = {
        ...form,
        value: Number(form.value),
        categoryId: form.categoryId === '' ? undefined : form.categoryId,
        date: dateToUse,
      };
      const newId = await onSubmitAction(submitData);
      const transactionId = initialData ? initialData.id : newId;
      if (initialData && filesToRemove.length > 0) {
        for (const fileId of filesToRemove) {
          await removeFileMutation.mutateAsync(fileId);
        }
        setFilesToRemove([]);
      }
      if (pendingFiles.length > 0 && transactionId) {
        for (const file of pendingFiles) {
          try {
            await directS3Upload.upload(transactionId, file);
          } catch (err) {
            handleUploadError(err);
          }
        }
        setPendingFiles([]);
      }
      showSnackbar(
        initialData
          ? 'Transaction updated successfully'
          : 'Transaction created successfully',
        'success',
      );
      onCloseAction();
    } catch {
      showSnackbar('Failed to save transaction', 'error');
    } finally {
      setIsLoadingUpdate(false);
    }
  };

  async function handleDelete() {
    if (initialData && onDeleteAction) {
      setIsLoadingDelete(true);
      try {
        await onDeleteAction(initialData.id);
        showSnackbar('Transaction deleted successfully', 'success');
        onCloseAction();
      } catch {
        showSnackbar('Failed to delete transaction', 'error');
      } finally {
        setIsLoadingDelete(false);
      }
    }
  }

  const getDialogTitle = () => {
    if (mode === 'approve') return 'Approve Imported Transaction';
    if (mode === 'merge') return 'Merge Imported Transaction';
    return initialData ? 'Edit Transaction' : 'New Transaction';
  };

  const getSubmitButtonText = () => {
    if (mode === 'approve') return 'Approve';
    if (mode === 'merge') return 'Merge';
    return initialData ? 'Update' : 'Create';
  };

  const busy = isLoadingUpdate || isLoadingDelete;

  return (
    <>
      <Dialog
        open={open}
        onClose={busy ? undefined : onCloseAction}
        fullWidth
        fullScreen={fullScreen}
        disableEscapeKeyDown={busy}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>{getDialogTitle()}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
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
              onChange={(value) => setForm({ ...form, categoryId: value })}
              error={!!errors.categoryId}
              helperText={errors.categoryId}
              label="Category"
              fullWidth
            />
            {form.categoryId === '' && !requireCategory && (
              <Typography
                variant="caption"
                sx={{ color: 'warning.main', mt: -1 }}
              >
                If category is not filled, it will be generated by AI.
              </Typography>
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
            />
            <TransactionAttachments
              transactionId={initialData?.id}
              pendingFiles={pendingFiles}
              setPendingFiles={setPendingFiles}
              filesToRemove={filesToRemove}
              setFilesToRemove={setFilesToRemove}
              submitButtonLabel={getSubmitButtonText()}
            />
            {fileUploadError && (
              <Typography variant="body2" color="error.main">
                {fileUploadError}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{ px: 3, pb: 2.5, pt: 1, justifyContent: 'space-between' }}
        >
          {initialData && onDeleteAction ? (
            <Button
              color="error"
              onClick={handleDelete}
              disabled={busy}
              startIcon={
                isLoadingDelete ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <DeleteIcon />
                )
              }
            >
              Delete
            </Button>
          ) : (
            <Box />
          )}
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" onClick={onCloseAction} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={busy}
              startIcon={
                isLoadingUpdate ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SaveIcon />
                )
              }
            >
              {getSubmitButtonText()}
            </Button>
          </Stack>
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
