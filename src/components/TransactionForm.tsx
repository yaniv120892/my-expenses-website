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
import type { CreateTransactionInput } from '../types';
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
import { BASE_CURRENCY, isForeignCurrency, SELECTABLE_CURRENCIES } from '@/shared/currency';
import type { ExchangeRateSource, TransactionAmountInput } from '@/shared/types/transaction';
import type { TransactionFormErrors } from '@/utils/transactionFormValidation.types';
import { useAppFormat, type AppFormatter } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import type { T } from '@/i18n/useT.types';

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
  /** Resolves to the new transaction's id when it creates one. */
  onSubmitAction: (data: CreateTransactionInput) => Promise<string> | Promise<void>;
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
function toFormValues(initialData: TransactionFormType, confirmsImportedRow: boolean): FormValues {
  const foreignCurrency =
    !confirmsImportedRow && initialData.currency && isForeignCurrency(initialData.currency)
      ? initialData.currency
      : null;
  return {
    id: initialData.id,
    description: initialData.description,
    value: foreignCurrency ? (initialData.originalAmount ?? '') : (initialData.value ?? ''),
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

function baseValueHelperText({
  editsSameCurrency,
  t,
}: {
  editsSameCurrency: boolean;
  t: T;
}): string {
  return editsSameCurrency
    ? t('transactions.form.baseValueHintKeep')
    : t('transactions.form.baseValueHint');
}

function describeConversion({
  initialData,
  t,
  formatter,
}: {
  initialData: TransactionFormType;
  t: T;
  formatter: AppFormatter;
}): string | null {
  const { currency } = initialData;
  if (currency === undefined || currency === BASE_CURRENCY) {
    return null;
  }
  if (currency === null) {
    return t('transactions.form.conversion.unknownCurrency', {
      amount: formatter.number({ value: initialData.originalAmount ?? 0 }),
    });
  }
  const original = formatter.money(initialData.originalAmount ?? 0, currency);
  if (initialData.value === null || initialData.value === '') {
    return t('transactions.form.conversion.noRate', {
      original,
      currency: BASE_CURRENCY,
    });
  }
  const source = initialData.exchangeRateSource
    ? formatter.exchangeRateSource(initialData.exchangeRateSource)
    : t('transactions.form.conversion.unknownSource');
  return t('transactions.form.conversion.converted', {
    original,
    converted: formatter.currency(Number(initialData.value)),
    rate: initialData.exchangeRate ?? '?',
    source,
  });
}

export default function TransactionForm({
  open,
  onCloseAction,
  onSubmitAction,
  onDeleteAction,
  initialData,
  mode,
}: Props) {
  const t = useT();
  const formatter = useAppFormat();
  const fullScreen = useIsCompact();
  const confirmsImportedRow = mode !== undefined;
  const conversionNote = initialData ? describeConversion({ initialData, t, formatter }) : null;
  const [form, setForm] = useState<FormValues>(() =>
    initialData ? toFormValues(initialData, confirmsImportedRow) : freshDefaultForm(),
  );
  const [isLoadingUpdate, setIsLoadingUpdate] = useState(false);
  const [isLoadingDelete, setIsLoadingDelete] = useState(false);
  const [errors, setErrors] = useState<TransactionFormErrors>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<SnackbarSeverity>('success');
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
    setForm(initialData ? toFormValues(initialData, confirmsImportedRow) : freshDefaultForm());
    setErrors({});
    setPendingFiles([]);
    setFilesToRemove([]);
  }

  const requireCategory = mode === 'merge' || (!mode && Boolean(initialData));

  const validate = () => {
    const nextErrors = validateTransactionForm({ form, requireCategory });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const getCurrentDateTimeString = () => {
    return format(new Date(), DAY_TIME_FORMAT);
  };

  const showSnackbar = (message: string, severity: SnackbarSeverity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const errorText = (field: keyof TransactionFormErrors) => {
    const message = errors[field];
    return message ? t(message) : undefined;
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
      const submitResult = await onSubmitAction(submitData);
      const newId = typeof submitResult === 'string' ? submitResult : undefined;
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
            t('transactions.form.removeAttachmentFailed'),
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
              t('transactions.form.uploadAttachmentFailed'),
              err,
            );
          }
        }
        setPendingFiles([]);
      }
      // Not a failed save, but it goes through the snackbar: closing the dialog
      // unmounts the alert that also carries it.
      if (attachmentFailure) {
        showSnackbar(t('transactions.form.saved', { failure: attachmentFailure }), 'warning');
      } else {
        showSnackbar(
          initialData ? t('transactions.form.updated') : t('transactions.form.created'),
          'success',
        );
      }
      onCloseAction();
    } catch (err) {
      showSnackbar(describeApiError(err, t('transactions.form.saveFailed')), 'error');
    } finally {
      setIsLoadingUpdate(false);
    }
  };

  async function handleDelete() {
    if (initialData && onDeleteAction) {
      setIsLoadingDelete(true);
      try {
        await onDeleteAction(initialData.id);
        showSnackbar(t('transactions.form.deleted'), 'success');
        onCloseAction();
      } catch (err) {
        showSnackbar(describeApiError(err, t('transactions.form.deleteFailed')), 'error');
      } finally {
        setIsLoadingDelete(false);
      }
    }
  }

  const getDialogTitle = () => {
    if (mode === 'approve') {
      return t('transactions.form.title.approve');
    }
    if (mode === 'merge') {
      return t('transactions.form.title.merge');
    }
    return initialData ? t('transactions.form.title.edit') : t('transactions.form.title.new');
  };

  const getSubmitButtonText = () => {
    if (mode === 'approve') {
      return t('transactions.form.submit.approve');
    }
    if (mode === 'merge') {
      return t('transactions.form.submit.merge');
    }
    return initialData
      ? t('transactions.form.submit.update')
      : t('transactions.form.submit.create');
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
              label={t('common.description')}
              name="description"
              value={form.description}
              onChange={handleChange}
              error={!!errors.description}
              helperText={errorText('description')}
              fullWidth
            />
            <Stack direction="row" spacing={1.5}>
              <TextField
                label={
                  confirmsImportedRow
                    ? t('transactions.form.valueInCurrency', {
                        currency: BASE_CURRENCY,
                      })
                    : t('transactions.form.value')
                }
                name="value"
                type="number"
                value={form.value}
                onChange={handleChange}
                error={!!errors.value}
                helperText={errorText('value')}
                fullWidth
              />
              {!confirmsImportedRow && (
                <TextField
                  select
                  label={t('transactions.form.currency')}
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
                label={t('transactions.form.baseValue', {
                  currency: BASE_CURRENCY,
                })}
                name="baseValue"
                type="number"
                value={form.baseValue}
                onChange={handleChange}
                error={!!errors.baseValue}
                helperText={
                  errorText('baseValue') ??
                  baseValueHelperText({
                    editsSameCurrency: initialData?.currency === form.currency,
                    t,
                  })
                }
                fullWidth
              />
            )}
            {conversionNote && (
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: -1 }}>
                {conversionNote}
              </Typography>
            )}
            <CategorySelect
              value={form.categoryId}
              onChange={(value) => setForm({ ...form, categoryId: value })}
              error={!!errors.categoryId}
              helperText={errorText('categoryId')}
              label={t('common.category')}
              fullWidth
            />
            {form.categoryId === '' && !requireCategory && (
              <Typography variant="caption" sx={{ color: 'warning.main', mt: -1 }}>
                {t('transactions.form.aiCategoryHint')}
              </Typography>
            )}
            <TextField
              select
              label={t('common.type')}
              name="type"
              value={form.type}
              onChange={handleChange}
              error={!!errors.type}
              helperText={errorText('type')}
              fullWidth
            >
              <MenuItem value="EXPENSE">{t('common.expense')}</MenuItem>
              <MenuItem value="INCOME">{t('common.income')}</MenuItem>
            </TextField>
            <TextField
              label={t('common.date')}
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              error={!!errors.date}
              helperText={errorText('date')}
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
              {t('common.delete')}
            </Button>
          ) : (
            <Box />
          )}
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" onClick={onCloseAction} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={busy}
              startIcon={
                isLoadingUpdate ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />
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
