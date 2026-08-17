'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
} from '@mui/material';
import { useIsCompact } from '@/hooks/useBreakpoints';
import CategorySelect from '@/components/CategorySelect';
import { DetectedSubscription } from '@/types/subscription';
import { formatCurrency } from '@/utils/format';

interface Props {
  open: boolean;
  subscription: DetectedSubscription | null;
  onClose: () => void;
  onConvert: (id: string, categoryId: string) => void;
  isLoading: boolean;
}

export default function ConvertToScheduledDialog({
  open,
  subscription,
  onClose,
  onConvert,
  isLoading,
}: Props) {
  const [categoryId, setCategoryId] = useState('');
  const fullScreen = useIsCompact();

  useEffect(() => {
    if (open) {
      setCategoryId('');
    }
  }, [open]);

  function handleSubmit() {
    if (!subscription || !categoryId) return;
    onConvert(subscription.id, categoryId);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
    >
      <DialogTitle>Convert to Scheduled Transaction</DialogTitle>
      <DialogContent>
        {subscription && (
          <>
            <Box sx={{ mb: 2, mt: 1 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                Description
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {subscription.displayName}
              </Typography>
            </Box>
            <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
              <Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  Amount
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {formatCurrency(subscription.averageAmount)}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  Frequency
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {subscription.frequency}
                </Typography>
              </Box>
            </Stack>
            <CategorySelect
              value={categoryId}
              onChange={setCategoryId}
              required
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!categoryId || isLoading}
        >
          {isLoading ? 'Converting...' : 'Convert'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
