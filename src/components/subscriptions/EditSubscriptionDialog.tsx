'use client';

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useIsCompact } from '@/hooks/useBreakpoints';
import CategorySelect from '@/components/CategorySelect';
import type {
  DetectedSubscription,
  SubscriptionFrequency,
  UpdateSubscriptionPayload,
} from '@/types/subscription';
import { SUBSCRIPTION_FREQUENCIES } from '@/utils/format';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import { toMonthlyAmount, toAnnualAmount } from '@/utils/subscriptionMath';
import { isOneOf } from '@/utils/oneOf';

interface Props {
  open: boolean;
  subscription: DetectedSubscription | null;
  onClose: () => void;
  onSave: (id: string, payload: UpdateSubscriptionPayload) => void;
  isLoading: boolean;
  error?: string;
}

interface FormState {
  displayName: string;
  amount: string;
  frequency: SubscriptionFrequency;
  lastChargeDate: string;
  nextExpectedDate: string;
  categoryId: string;
}

function toDateInput(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function toFormState(subscription: DetectedSubscription): FormState {
  return {
    displayName: subscription.displayName,
    amount: String(subscription.averageAmount),
    frequency: subscription.frequency,
    lastChargeDate: toDateInput(subscription.lastChargeDate),
    nextExpectedDate: toDateInput(subscription.nextExpectedDate),
    categoryId: subscription.categoryId ?? '',
  };
}

const EMPTY_FORM: FormState = {
  displayName: '',
  amount: '',
  frequency: 'MONTHLY',
  lastChargeDate: '',
  nextExpectedDate: '',
  categoryId: '',
};

export default function EditSubscriptionDialog({
  open,
  subscription,
  onClose,
  onSave,
  isLoading,
  error,
}: Props) {
  const t = useT();
  const formatter = useAppFormat();
  const fullScreen = useIsCompact();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    if (open && subscription) {
      setForm(toFormState(subscription));
    }
  }, [open, subscription]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const parsedAmount = Number(form.amount);
  const amountError =
    form.amount.trim() === '' || !Number.isFinite(parsedAmount) || parsedAmount <= 0;
  const nameError = form.displayName.trim() === '';
  const canSave = !amountError && !nameError && !isLoading;

  function handleSave() {
    if (!subscription || !canSave) {
      return;
    }
    onSave(subscription.id, {
      displayName: form.displayName.trim(),
      averageAmount: parsedAmount,
      frequency: form.frequency,
      lastChargeDate: new Date(form.lastChargeDate).toISOString(),
      nextExpectedDate: new Date(form.nextExpectedDate).toISOString(),
      categoryId: form.categoryId || null,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{t('subscriptions.edit.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label={t('subscriptions.edit.name')}
            value={form.displayName}
            onChange={(e) => set('displayName', e.target.value)}
            error={nameError}
            helperText={nameError ? t('subscriptions.edit.nameRequired') : undefined}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label={t('subscriptions.edit.amount')}
              type="number"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              error={amountError}
              helperText={amountError ? t('subscriptions.edit.amountInvalid') : undefined}
              fullWidth
              slotProps={{
                htmlInput: { min: 0, step: '0.01' },
              }}
            />
            <TextField
              select
              label={t('subscriptions.edit.frequency')}
              value={form.frequency}
              onChange={(e) => {
                const frequency = e.target.value;
                if (isOneOf(SUBSCRIPTION_FREQUENCIES, frequency)) {
                  set('frequency', frequency);
                }
              }}
              fullWidth
            >
              {SUBSCRIPTION_FREQUENCIES.map((frequency) => (
                <MenuItem key={frequency} value={frequency}>
                  {formatter.frequency(frequency)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label={t('subscriptions.edit.lastCharge')}
              type="date"
              value={form.lastChargeDate}
              onChange={(e) => set('lastChargeDate', e.target.value)}
              fullWidth
              slotProps={{
                inputLabel: { shrink: true },
              }}
            />
            <TextField
              label={t('subscriptions.edit.nextExpected')}
              type="date"
              value={form.nextExpectedDate}
              onChange={(e) => set('nextExpectedDate', e.target.value)}
              fullWidth
              slotProps={{
                inputLabel: { shrink: true },
              }}
            />
          </Stack>
          <CategorySelect value={form.categoryId} onChange={(value) => set('categoryId', value)} />
          {!amountError && (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t('subscriptions.edit.costs', {
                monthly: formatter.currency(toMonthlyAmount(parsedAmount, form.frequency)),
                annual: formatter.currency(toAnnualAmount(parsedAmount, form.frequency)),
              })}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={!canSave}>
          {isLoading ? t('common.saving') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
