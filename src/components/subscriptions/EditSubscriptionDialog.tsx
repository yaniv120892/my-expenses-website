'use client';

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
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
import { formatCurrency } from '@/utils/format';
import { toMonthlyCost, toAnnualCost } from '@/utils/subscriptionCost';

const FREQUENCIES: { value: SubscriptionFrequency; label: string }[] = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

interface Props {
  open: boolean;
  subscription: DetectedSubscription | null;
  onClose: () => void;
  onSave: (id: string, payload: UpdateSubscriptionPayload) => void;
  isLoading: boolean;
  error?: string;
}

function toDateInput(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

export default function EditSubscriptionDialog({
  open,
  subscription,
  onClose,
  onSave,
  isLoading,
  error,
}: Props) {
  const fullScreen = useIsCompact();
  const [displayName, setDisplayName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<SubscriptionFrequency>('MONTHLY');
  const [lastChargeDate, setLastChargeDate] = useState('');
  const [nextExpectedDate, setNextExpectedDate] = useState('');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    if (!open || !subscription) return;
    setDisplayName(subscription.displayName);
    setAmount(String(subscription.averageAmount));
    setFrequency(subscription.frequency);
    setLastChargeDate(toDateInput(subscription.lastChargeDate));
    setNextExpectedDate(toDateInput(subscription.nextExpectedDate));
    setCategoryId(subscription.categoryId ?? '');
  }, [open, subscription]);

  const parsedAmount = Number(amount);
  const amountError =
    amount.trim() === '' || !Number.isFinite(parsedAmount) || parsedAmount <= 0;
  const nameError = displayName.trim() === '';
  const canSave = !amountError && !nameError && !isLoading;

  function handleSave() {
    if (!subscription || !canSave) return;
    onSave(subscription.id, {
      displayName: displayName.trim(),
      averageAmount: parsedAmount,
      frequency,
      lastChargeDate: new Date(lastChargeDate).toISOString(),
      nextExpectedDate: new Date(nextExpectedDate).toISOString(),
      categoryId: categoryId || null,
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
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={nameError}
            helperText={nameError ? 'Name is required' : undefined}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Amount per charge"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as SubscriptionFrequency)
              }
              fullWidth
            >
              {FREQUENCIES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Last charge"
              type="date"
              value={lastChargeDate}
              onChange={(e) => setLastChargeDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Next expected"
              type="date"
              value={nextExpectedDate}
              onChange={(e) => setNextExpectedDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
          <CategorySelect value={categoryId} onChange={setCategoryId} />
          {!amountError && (
            <Box>
              <Typography variant="body2" color="text.secondary">
                Costs {formatCurrency(toMonthlyCost(parsedAmount, frequency))}
                /month · {formatCurrency(toAnnualCost(parsedAmount, frequency))}
                /year
              </Typography>
            </Box>
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
