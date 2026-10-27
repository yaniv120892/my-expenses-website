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
import type {
  ScheduledTransaction,
  CreateScheduledTransactionInput,
  ScheduleType,
  TransactionType,
} from '../types';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import { useIsCompact } from '../hooks/useBreakpoints';
import CategorySelect from './CategorySelect';
import { describeApiError } from '@/utils/api';
import { isPositiveAmount } from '@/shared/schemas/amount';
import NotificationSnackbar from './NotificationSnackbar';
import {
  isUsableBankDescriptionPrefix,
  MINIMUM_BANK_DESCRIPTION_PREFIX_LENGTH,
} from '@/shared/descriptions';
import { scheduleSummary, useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';

type Props = {
  open: boolean;
  onCloseAction: () => void;
  onSubmitAction: (data: CreateScheduledTransactionInput) => Promise<void>;
  onDeleteAction?: (id: string) => Promise<void>;
  initialData?: ScheduledTransaction | null;
};

const defaultForm: Omit<CreateScheduledTransactionInput, 'date'> = {
  description: '',
  value: 0,
  categoryId: '',
  type: 'EXPENSE',
  scheduleType: 'MONTHLY',
};

const scheduleTypes = ['DAILY', 'WEEKLY', 'MONTHLY'] as const satisfies ScheduleType[];
const transactionTypes: TransactionType[] = ['EXPENSE', 'INCOME'];
const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 7];

export default function ScheduledTransactionForm({
  open,
  onCloseAction,
  onSubmitAction,
  onDeleteAction,
  initialData,
}: Props) {
  const t = useT();
  const formatter = useAppFormat();
  const fullScreen = useIsCompact();
  const [form, setForm] = useState<CreateScheduledTransactionInput>({
    ...defaultForm,
  });
  const [isLoadingUpdate, setIsLoadingUpdate] = useState(false);
  const [isLoadingDelete, setIsLoadingDelete] = useState(false);
  const [errors, setErrors] = useState<{ [field: string]: string }>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

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
        bankDescriptionPrefix: initialData.bankDescriptionPrefix,
      });
    } else {
      setForm({ ...defaultForm });
    }
    setErrors({});
  }, [initialData, open]);

  function getScheduleSummary() {
    return scheduleSummary({ schedule: form, t, formatter });
  }

  function validate() {
    const fieldErrors: { [field: string]: string } = {};
    if (!form.description) {
      fieldErrors.description = t('scheduled.validation.descriptionRequired');
    }
    if (!isPositiveAmount(form.value)) {
      fieldErrors.value = t('scheduled.validation.valuePositive');
    }
    if (!form.type) {
      fieldErrors.type = t('scheduled.validation.typeRequired');
    }
    if (!form.categoryId) {
      fieldErrors.categoryId = t('scheduled.validation.categoryRequired');
    }
    if (!form.scheduleType) {
      fieldErrors.scheduleType = t('scheduled.validation.scheduleTypeRequired');
    }
    const prefix = form.bankDescriptionPrefix?.trim() ?? '';
    if (prefix.length > 0 && !isUsableBankDescriptionPrefix(prefix)) {
      fieldErrors.bankDescriptionPrefix = t('scheduled.validation.prefixTooShort', {
        count: MINIMUM_BANK_DESCRIPTION_PREFIX_LENGTH,
      });
    }
    if (form.scheduleType === 'WEEKLY' && !form.dayOfWeek) {
      fieldErrors.dayOfWeek = t('scheduled.validation.dayOfWeekRequired');
    }
    if (form.scheduleType === 'MONTHLY' && !form.dayOfMonth) {
      fieldErrors.dayOfMonth = t('scheduled.validation.dayOfMonthRequired');
    }
    if (form.scheduleType === 'MONTHLY' && form.dayOfWeek) {
      fieldErrors.dayOfWeek = t('scheduled.validation.dayOfWeekNotMonthly');
    }
    if (form.scheduleType === 'DAILY' && (form.dayOfWeek || form.dayOfMonth || form.monthOfYear)) {
      if (form.dayOfWeek) {
        fieldErrors.dayOfWeek = t('scheduled.validation.dayOfWeekNotDaily');
      }
      if (form.dayOfMonth) {
        fieldErrors.dayOfMonth = t('scheduled.validation.dayOfMonthNotDaily');
      }
      if (form.monthOfYear) {
        fieldErrors.monthOfYear = t('scheduled.validation.monthOfYearNotDaily');
      }
    }
    if (form.scheduleType === 'WEEKLY' && (form.dayOfMonth || form.monthOfYear)) {
      if (form.dayOfMonth) {
        fieldErrors.dayOfMonth = t('scheduled.validation.dayOfMonthNotWeekly');
      }
      if (form.monthOfYear) {
        fieldErrors.monthOfYear = t('scheduled.validation.monthOfYearNotWeekly');
      }
    }
    setErrors(fieldErrors);
    return Object.keys(fieldErrors).length === 0;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({
      ...form,
      [e.target.name]: e.target.value === '' ? undefined : Number(e.target.value),
    });
  }

  function showSnackbar(message: string, severity: 'success' | 'error' = 'success') {
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
      showSnackbar(initialData ? t('scheduled.updated') : t('scheduled.created'), 'success');
      onCloseAction();
    } catch (err) {
      showSnackbar(describeApiError(err, t('scheduled.saveFailed')), 'error');
    } finally {
      setIsLoadingUpdate(false);
    }
  }

  async function handleDelete() {
    if (initialData && onDeleteAction) {
      setIsLoadingDelete(true);
      try {
        await onDeleteAction(initialData.id);
        showSnackbar(t('scheduled.deleted'), 'success');
        onCloseAction();
      } catch (err) {
        showSnackbar(describeApiError(err, t('scheduled.deleteFailed')), 'error');
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
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {initialData ? t('scheduled.form.editTitle') : t('scheduled.form.newTitle')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {getScheduleSummary()}
            </Typography>
            <TextField
              label={t('scheduled.form.description')}
              name="description"
              value={form.description}
              onChange={handleChange}
              error={!!errors.description}
              helperText={errors.description}
              fullWidth
            />
            <TextField
              label={t('scheduled.form.value')}
              name="value"
              type="number"
              value={form.value}
              onChange={handleNumberChange}
              error={!!errors.value}
              helperText={errors.value}
              fullWidth
            />
            <TextField
              label={t('scheduled.form.prefix')}
              name="bankDescriptionPrefix"
              value={form.bankDescriptionPrefix ?? ''}
              onChange={handleChange}
              error={!!errors.bankDescriptionPrefix}
              helperText={errors.bankDescriptionPrefix ?? t('scheduled.form.prefixHint')}
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
              label={t('scheduled.form.type')}
              name="type"
              value={form.type}
              onChange={handleChange}
              error={!!errors.type}
              helperText={errors.type}
              fullWidth
            >
              {transactionTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {t(`scheduled.type.${type}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t('scheduled.form.scheduleType')}
              name="scheduleType"
              value={form.scheduleType}
              onChange={handleChange}
              error={!!errors.scheduleType}
              helperText={errors.scheduleType}
              fullWidth
            >
              {scheduleTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {t(`scheduled.scheduleType.${type}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('scheduled.form.interval')}
              name="interval"
              type="number"
              value={form.interval ?? ''}
              onChange={handleNumberChange}
              fullWidth
            />
            {form.scheduleType === 'WEEKLY' && (
              <TextField
                select
                label={t('scheduled.form.dayOfWeek')}
                name="dayOfWeek"
                value={form.dayOfWeek ?? ''}
                onChange={handleNumberChange}
                error={!!errors.dayOfWeek}
                helperText={errors.dayOfWeek}
                fullWidth
              >
                <MenuItem value="">
                  <em>{t('scheduled.form.chooseDay')}</em>
                </MenuItem>
                {DAYS_OF_WEEK.map((day) => (
                  <MenuItem key={day} value={day}>
                    {formatter.weekday(day)}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {form.scheduleType === 'MONTHLY' && (
              <TextField
                label={t('scheduled.form.dayOfMonth')}
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
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, justifyContent: 'space-between' }}>
          {initialData && onDeleteAction ? (
            <Button
              color="error"
              onClick={handleDelete}
              disabled={busy}
              startIcon={
                isLoadingDelete ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />
              }
            >
              {t('scheduled.form.delete')}
            </Button>
          ) : (
            <Box />
          )}
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" onClick={onCloseAction} disabled={busy}>
              {t('scheduled.form.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={busy}
              startIcon={
                isLoadingUpdate ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />
              }
            >
              {initialData ? t('scheduled.form.update') : t('scheduled.form.create')}
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
