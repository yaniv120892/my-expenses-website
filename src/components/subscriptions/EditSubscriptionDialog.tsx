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
import {
  DetectedSubscription,
  SubscriptionFrequency,
  UpdateSubscriptionPayload,
} from '@/types/subscription';
import {
  formatCurrency,
  formatSubscriptionFrequency,
  SUBSCRIPTION_FREQUENCIES,
} from '@/utils/format';
import { toMonthlyAmount, toAnnualAmount } from '@/utils/subscriptionMath';

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
    form.amount.trim() === '' ||
    !Number.isFinite(parsedAmount) ||
    parsedAmount <= 0;
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
    >
      <DialogTitle>Edit subscription</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Name"
            value={form.displayName}
            onChange={(e) => set('displayName', e.target.value)}
            error={nameError}
            helperText={nameError ? 'Name is required' : undefined}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Amount per charge"
              type="number"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              error={amountError}
              helperText={
                amountError ? 'Enter an amount greater than zero' : undefined
              }
              inputProps={{ min: 0, step: '0.01' }}
              fullWidth
            />
            <TextField
              select
              label="Frequency"
              value={form.frequency}
              onChange={(e) =>
                set('frequency', e.target.value as SubscriptionFrequency)
              }
              fullWidth
            >
              {SUBSCRIPTION_FREQUENCIES.map((frequency) => (
                <MenuItem key={frequency} value={frequency}>
                  {formatSubscriptionFrequency(frequency)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Last charge"
              type="date"
              value={form.lastChargeDate}
              onChange={(e) => set('lastChargeDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Next expected"
              type="date"
              value={form.nextExpectedDate}
              onChange={(e) => set('nextExpectedDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
          <CategorySelect
            value={form.categoryId}
            onChange={(value) => set('categoryId', value)}
          />
          {!amountError && (
            <Typography variant="body2" color="text.secondary">
              Costs{' '}
              {formatCurrency(toMonthlyAmount(parsedAmount, form.frequency))}
              /month ·{' '}
              {formatCurrency(toAnnualAmount(parsedAmount, form.frequency))}
              /year
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={!canSave}>
          {isLoading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
