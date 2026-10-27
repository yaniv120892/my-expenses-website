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
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';

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
  const t = useT();
  const formatter = useAppFormat();
  const fullScreen = useIsCompact();

  useEffect(() => {
    if (open) {
      setCategoryId(subscription?.categoryId ?? '');
    }
  }, [open, subscription]);

  function handleSubmit() {
    if (!subscription || !categoryId) {
      return;
    }
    onConvert(subscription.id, categoryId);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{t('subscriptions.convert.title')}</DialogTitle>
      <DialogContent>
        {subscription && (
          <>
            <Box sx={{ mb: 2, mt: 1 }}>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mb: 0.5,
                }}
              >
                {t('subscriptions.convert.description')}
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 600,
                }}
              >
                {subscription.displayName}
              </Typography>
            </Box>
            <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
              <Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    mb: 0.5,
                  }}
                >
                  {t('subscriptions.convert.amount')}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 600,
                  }}
                >
                  {formatter.currency(subscription.averageAmount)}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    mb: 0.5,
                  }}
                >
                  {t('subscriptions.convert.frequency')}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 600,
                  }}
                >
                  {formatter.frequency(subscription.frequency)}
                </Typography>
              </Box>
            </Stack>
            <CategorySelect value={categoryId} onChange={setCategoryId} required />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!categoryId || isLoading}>
          {isLoading ? t('subscriptions.convert.submitting') : t('subscriptions.convert.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
