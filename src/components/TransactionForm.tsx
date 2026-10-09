'use client';

import React, { useState } from 'react';
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
import { describeApiError } from '@/utils/api';
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
import { DAY_TIME_FORMAT, toDayString } from '@/shared/dates';
import {
  BASE_CURRENCY,
  isForeignCurrency,
  SELECTABLE_CURRENCIES,
} from '@/shared/currency';
import type {
  ExchangeRateSource,
  TransactionAmountInput,
} from '@/shared/types/transaction';
import {
  EXCHANGE_RATE_SOURCE_LABELS,
  formatCurrencyPlain,
  formatMoney,
} from '@/utils/format';

// An edited transaction may be in a currency outside the usual list.
function currencyOptions(current: string): readonly string[] {
  return SELECTABLE_CURRENCIES.includes(current)
    ? SELECTABLE_CURRENCIES
    : [...SELECTABLE_CURRENCIES, current];
}

// `value` is ILS. A foreign amount also carries `currency` and
// `originalAmount`; `currency` null is an imported row whose currency the
// statement did not tell, and `value` null one whose ILS amount is unknown.
type TransactionFormType = {
  id: string;
  description: string;
  value: number | string | null;
  currency?: string | null;
  originalAmount?: number;
  exchangeRate?: number | null;
  exchangeRateSource?: ExchangeRateSource | null;
  categoryId: string;
  type: 'EXPENSE' | 'INCOME';
  date: string;
};

// The amount field is in `currency`; `baseValue` is the ILS charged, asked
// for only beside a foreign amount, where leaving it empty means "convert".
type FormValues = {
  id: string;
  description: string;
  value: number | string;
  currency: string;
  baseValue: number | string;
  categoryId: string;
  type: 'EXPENSE' | 'INCOME';
  date: string;
};

type SnackbarSeverity = 'success' | 'error' | 'warning';

type Props = {
  open: boolean;
  onCloseAction: () => void;
  onSubmitAction: (data: CreateTransactionInput) => Promise<string | void>;
  onDeleteAction?: (id: string) => Promise<void>;
  initialData?: TransactionFormType | null;
  mode?: 'approve' | 'merge';
};

const defaultForm: Omit<FormValues, 'date'> = {
  id: '',
  description: '',
  value: '',
  currency: BASE_CURRENCY,
  baseValue: '',
  categoryId: '',
  type: 'EXPENSE',
};

// Built per call so the default date is today's, not the module-load day.
function freshDefaultForm(): FormValues {
  return { ...defaultForm, date: toDayString(new Date()) };
}

/**
 * Approving or merging an imported row confirms its ILS amount, so the amount
 * field is ILS there; elsewhere it is in the transaction's own currency, and
 * the ILS field starts empty so an untouched edit keeps its conversion.
 */
function toFormValues(
  initialData: TransactionFormType,
  confirmsImportedRow: boolean,
): FormValues {
  const foreignCurrency =
    !confirmsImportedRow &&
    initialData.currency &&
    isForeignCurrency(initialData.currency)
      ? initialData.currency
      : null;
  return {
    id: initialData.id,
    description: initialData.description,
    value: foreignCurrency
      ? (initialData.originalAmount ?? '')
      : (initialData.value ?? ''),
    currency: foreignCurrency ?? BASE_CURRENCY,
    baseValue: '',
    categoryId: initialData.categoryId || '',
    type: initialData.type,
    date: toDayString(new Date(initialData.date)),
  };
}

function toAmountInput(form: FormValues): TransactionAmountInput {
  if (!isForeignCurrency(form.currency)) {
    return { value: Number(form.value), currency: BASE_CURRENCY };
  }
  return {
    currency: form.currency,
    originalAmount: Number(form.value),
    ...(form.baseValue === '' ? {} : { value: Number(form.baseValue) }),
  };
}

function describeConversion(initialData: TransactionFormType): string | null {
  const { currency } = initialData;
  if (currency === undefined || currency === BASE_CURRENCY) {
    return null;
  }
  if (currency === null) {
    return `Original amount ${initialData.originalAmount}; the statement does not say which currency it is in.`;
  }
  const original = formatMoney(initialData.originalAmount ?? 0, currency);
  if (initialData.value === null || initialData.value === '') {
    return `Original ${original}. No exchange rate was available: enter the ${BASE_CURRENCY} amount charged.`;
  }
  const source = initialData.exchangeRateSource
    ? EXCHANGE_RATE_SOURCE_LABELS[initialData.exchangeRateSource]
    : 'unknown source';
  return `Original ${original} = ${formatCurrencyPlain(Number(initialData.value))} at ${initialData.exchangeRate ?? '?'} (${source}).`;
}

export default function TransactionForm({
  open,
  onCloseAction,
  onSubmitAction,
  onDeleteAction,
  initialData,
  mode,
}: Props) {
  const fullScreen = useIsCompact();
  const confirmsImportedRow = mode !== undefined;
  const conversionNote = initialData ? describeConversion(initialData) : null;
  const [form, setForm] = useState<FormValues>(() =>
    initialData
      ? toFormValues(initialData, confirmsImportedRow)
      : freshDefaultForm(),
  );
  const [isLoadingUpdate, setIsLoadingUpdate] = useState(false);
  const [isLoadingDelete, setIsLoadingDelete] = useState(false);
  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] =
    useState<SnackbarSeverity>('success');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [filesToRemove, setFilesToRemove] = useState<string[]>([]);

  const directS3Upload = useDirectS3UploadForAttachment();
  const removeFileMutation = useRemoveFileMutation(initialData?.id || '');

  // Parents rebuild initialData as a fresh literal every render, so keying
  // the reset on its identity would wipe typed input on a background refetch.
  const resetKey = `${open}:${initialData?.id ?? 'new'}`;
  const [appliedResetKey, setAppliedResetKey] = useState(resetKey);
  if (appliedResetKey !== resetKey) {
    setAppliedResetKey(resetKey);
    setForm(
      initialData
        ? toFormValues(initialData, confirmsImportedRow)
        : freshDefaultForm(),
    );
    setErrors({});
    setPendingFiles([]);
    setFilesToRemove([]);
  }

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
    return format(new Date(), DAY_TIME_FORMAT);
  };

  const showSnackbar = (
    message: string,
    severity: SnackbarSeverity = 'success',
  ) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const describeAttachmentFailure = (summary: string, err: unknown): string => {
    const message = describeApiError(err, summary);
    return message === summary ? summary : `${summary} ${message}`;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }
    setIsLoadingUpdate(true);
    try {
      let dateToUse = form.date;
      if (!initialData) {
        const today = toDayString(new Date());
        if (form.date === today) {
          dateToUse = getCurrentDateTimeString();
        }
      }
      const submitData: CreateTransactionInput = {
        description: form.description,
        type: form.type,
        ...toAmountInput(form),
        categoryId: form.categoryId === '' ? undefined : form.categoryId,
        date: dateToUse,
      };
      const newId = await onSubmitAction(submitData);
      const transactionId = initialData ? initialData.id : newId;
      let attachmentFailure: string | null = null;
      if (initialData && filesToRemove.length > 0) {
        try {
          for (const fileId of filesToRemove) {
            await removeFileMutation.mutateAsync(fileId);
          }
          setFilesToRemove([]);
        } catch (err) {
          attachmentFailure = describeAttachmentFailure(
            'Removing an attachment failed.',
            err,
          );
        }
      }
      if (pendingFiles.length > 0 && transactionId) {
        for (const file of pendingFiles) {
          try {
            await directS3Upload.upload(transactionId, file);
          } catch (err) {
            attachmentFailure = describeAttachmentFailure(
              'Direct S3 upload failed.',
              err,
            );
          }
        }
        setPendingFiles([]);
      }
      // Not a failed save, but it goes through the snackbar: closing the dialog
      // unmounts the alert that also carries it.
      if (attachmentFailure) {
        showSnackbar(`Transaction saved. ${attachmentFailure}`, 'warning');
      } else {
        showSnackbar(
          initialData
            ? 'Transaction updated successfully'
            : 'Transaction created successfully',
          'success',
        );
      }
      onCloseAction();
    } catch (err) {
      showSnackbar(
        describeApiError(err, 'Failed to save transaction'),
        'error',
      );
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
      } catch (err) {
        showSnackbar(
          describeApiError(err, 'Failed to delete transaction'),
          'error',
        );
      } finally {
        setIsLoadingDelete(false);
      }
    }
  }

  const getDialogTitle = () => {
    if (mode === 'approve') {
      return 'Approve Imported Transaction';
    }
    if (mode === 'merge') {
      return 'Merge Imported Transaction';
    }
    return initialData ? 'Edit Transaction' : 'New Transaction';
  };

  const getSubmitButtonText = () => {
    if (mode === 'approve') {
      return 'Approve';
    }
    if (mode === 'merge') {
      return 'Merge';
    }
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
            <Stack direction="row" spacing={1.5}>
              <TextField
                label={
                  confirmsImportedRow ? `Value (${BASE_CURRENCY})` : 'Value'
                }
                name="value"
                type="number"
                value={form.value}
                onChange={handleChange}
                error={!!errors.value}
                helperText={errors.value}
                fullWidth
              />
              {!confirmsImportedRow && (
                <TextField
                  select
                  label="Currency"
                  name="currency"
                  value={form.currency}
                  onChange={handleChange}
                  sx={{ minWidth: 110 }}
                >
                  {currencyOptions(form.currency).map((currency) => (
                    <MenuItem key={currency} value={currency}>
                      {currency}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Stack>
            {!confirmsImportedRow && isForeignCurrency(form.currency) && (
              <TextField
                label={`Amount charged in ${BASE_CURRENCY} (optional)`}
                name="baseValue"
                type="number"
                value={form.baseValue}
                onChange={handleChange}
                error={!!errors.baseValue}
                helperText={
                  errors.baseValue ??
                  `Leave empty to convert at the Bank of Israel rate for the date${
                    initialData && initialData.currency === form.currency
                      ? ', or keep the current conversion if amount and date are unchanged'
                      : ''
                  }.`
                }
                fullWidth
              />
            )}
            {conversionNote && (
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', mt: -1 }}
              >
                {conversionNote}
              </Typography>
            )}
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
