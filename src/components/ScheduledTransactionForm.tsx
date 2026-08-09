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
import {
  ScheduledTransaction,
  CreateScheduledTransactionInput,
  ScheduleType,
  TransactionType,
} from '../types';
import { translateToScheduleSummary } from '../utils/format';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import { useIsCompact } from '../hooks/useBreakpoints';
import CategorySelect from './CategorySelect';
import NotificationSnackbar from './NotificationSnackbar';

interface Props {
  open: boolean;
  onCloseAction: () => void;
  onSubmitAction: (data: CreateScheduledTransactionInput) => Promise<void>;
  onDeleteAction?: (id: string) => Promise<void>;
  initialData?: ScheduledTransaction | null;
}

const defaultForm: Omit<CreateScheduledTransactionInput, 'date'> = {
  description: '',
  value: 0,
  categoryId: '',
  type: 'EXPENSE',
  scheduleType: 'MONTHLY',
};

const scheduleTypes: ScheduleType[] = ['DAILY', 'WEEKLY', 'MONTHLY'];
const transactionTypes: TransactionType[] = ['EXPENSE', 'INCOME'];

export default function ScheduledTransactionForm({
  open,
  onCloseAction,
  onSubmitAction,
  onDeleteAction,
  initialData,
}: Props) {
  const fullScreen = useIsCompact();
  const [form, setForm] = useState<CreateScheduledTransactionInput>({
    ...defaultForm,
  });
  const [isLoadingUpdate, setIsLoadingUpdate] = useState(false);
  const [isLoadingDelete, setIsLoadingDelete] = useState(false);
  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>(
    'success',
  );

  useEffect(() => {
    if (initialData) {
      setForm({
        description: initialData.description,
        value: initialData.value,
        categoryId: initialData.categoryId,
        type: initialData.type,
        scheduleType: initialData.scheduleType,
        interval: initialData.interval,
        dayOfWeek: initialData.dayOfWeek,
        dayOfMonth: initialData.dayOfMonth,
      });
    } else {
      setForm({ ...defaultForm });
    }
    setErrors({});
  }, [initialData, open]);

  function getScheduleSummary() {
    return translateToScheduleSummary(
      form.scheduleType,
      form.interval,
      form.dayOfWeek,
      form.dayOfMonth,
    );
  }

  function validate() {
    const errs: { [k: string]: string } = {};
    if (!form.description) {
      errs.description = 'Description is required';
    }
    if (!form.value || form.value <= 0) {
      errs.value = 'Value must be greater than 0';
    }
    if (!form.type) {
      errs.type = 'Type is required';
    }
    if (!form.categoryId) {
      errs.categoryId = 'Category is required';
    }
    if (!form.scheduleType) {
      errs.scheduleType = 'Schedule type is required';
    }
    if (form.scheduleType === 'WEEKLY' && !form.dayOfWeek) {
      errs.dayOfWeek = 'Day of week is required';
    }
    if (form.scheduleType === 'MONTHLY' && !form.dayOfMonth) {
      errs.dayOfMonth = 'Day of month is required';
    }
    if (form.scheduleType === 'MONTHLY' && form.dayOfWeek) {
      errs.dayOfWeek = 'Day of week is not valid for monthly schedule';
    }
    if (
      form.scheduleType === 'DAILY' &&
      (form.dayOfWeek || form.dayOfMonth || form.monthOfYear)
    ) {
      if (form.dayOfWeek) {
        errs.dayOfWeek = 'Day of week is not valid for daily schedule';
      }
      if (form.dayOfMonth) {
        errs.dayOfMonth = 'Day of month is not valid for daily schedule';
      }
      if (form.monthOfYear) {
        errs.monthOfYear = 'Month of year is not valid for daily schedule';
      }
    }
    if (
      form.scheduleType === 'WEEKLY' &&
      (form.dayOfMonth || form.monthOfYear)
    ) {
      if (form.dayOfMonth) {
        errs.dayOfMonth = 'Day of month is not valid for weekly schedule';
      }
      if (form.monthOfYear) {
        errs.monthOfYear = 'Month of year is not valid for weekly schedule';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({
      ...form,
      [e.target.name]:
        e.target.value === '' ? undefined : Number(e.target.value),
    });
  }

  function showSnackbar(
    message: string,
    severity: 'success' | 'error' = 'success',
  ) {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }

  async function handleSubmit() {
    if (!validate()) {
      return;
    }
    setIsLoadingUpdate(true);
    try {
      await onSubmitAction(form);
      showSnackbar(
        initialData
          ? 'Scheduled transaction updated successfully'
          : 'Scheduled transaction created successfully',
        'success',
      );
      onCloseAction();
    } catch {
      showSnackbar('Failed to save scheduled transaction', 'error');
    } finally {
      setIsLoadingUpdate(false);
    }
  }

  async function handleDelete() {
    if (initialData && onDeleteAction) {
      setIsLoadingDelete(true);
      try {
        await onDeleteAction(initialData.id);
        showSnackbar('Scheduled transaction deleted successfully', 'success');
        onCloseAction();
      } catch {
        showSnackbar('Failed to delete scheduled transaction', 'error');
      } finally {
        setIsLoadingDelete(false);
      }
    }
  }

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
        <DialogTitle sx={{ fontWeight: 700 }}>
          {initialData
            ? 'Edit Scheduled Transaction'
            : 'New Scheduled Transaction'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {getScheduleSummary()}
            </Typography>
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
              onChange={handleNumberChange}
              error={!!errors.value}
              helperText={errors.value}
              fullWidth
            />
            <CategorySelect
              value={form.categoryId}
              onChange={(value) => setForm({ ...form, categoryId: value })}
              error={!!errors.categoryId}
              helperText={errors.categoryId}
            />
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
              {transactionTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type.charAt(0) + type.slice(1).toLowerCase()}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Schedule Type"
              name="scheduleType"
              value={form.scheduleType}
              onChange={handleChange}
              error={!!errors.scheduleType}
              helperText={errors.scheduleType}
              fullWidth
            >
              {scheduleTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type.charAt(0) + type.slice(1).toLowerCase()}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Interval"
              name="interval"
              type="number"
              value={form.interval ?? ''}
              onChange={handleNumberChange}
              fullWidth
            />
            {form.scheduleType === 'WEEKLY' && (
              <TextField
                select
                label="Day of Week"
                name="dayOfWeek"
                value={form.dayOfWeek ?? ''}
                onChange={handleNumberChange}
                error={!!errors.dayOfWeek}
                helperText={errors.dayOfWeek}
                fullWidth
              >
                <MenuItem value="">
                  <em>Choose day</em>
                </MenuItem>
                <MenuItem value={1}>Sunday</MenuItem>
                <MenuItem value={2}>Monday</MenuItem>
                <MenuItem value={3}>Tuesday</MenuItem>
                <MenuItem value={4}>Wednesday</MenuItem>
                <MenuItem value={5}>Thursday</MenuItem>
                <MenuItem value={6}>Friday</MenuItem>
                <MenuItem value={7}>Saturday</MenuItem>
              </TextField>
            )}
            {form.scheduleType === 'MONTHLY' && (
              <TextField
                label="Day of Month"
                name="dayOfMonth"
                type="number"
                value={form.dayOfMonth ?? ''}
                onChange={handleNumberChange}
                error={!!errors.dayOfMonth}
                helperText={errors.dayOfMonth}
                fullWidth
              />
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
              {initialData ? 'Update' : 'Create'}
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
