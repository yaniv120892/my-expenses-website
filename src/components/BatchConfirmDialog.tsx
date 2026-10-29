'use client';

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
} from '@mui/material';
import { useT } from '@/i18n/useT';
import type { T } from '@/i18n/useT.types';

type BatchAction = 'approve' | 'ignore';

type BatchConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  action: BatchAction;
  count: number;
  isLoading: boolean;
};

export default function BatchConfirmDialog({
  open,
  onClose,
  onConfirm,
  action,
  count,
  isLoading,
}: BatchConfirmDialogProps) {
  const t = useT();
  const isApprove = action === 'approve';

  return (
    <Dialog open={open} onClose={isLoading ? undefined : onClose}>
      <DialogTitle>
        {isApprove ? t('imports.batch.confirmApproveTitle') : t('imports.batch.confirmIgnoreTitle')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>{confirmationText({ action, count, t })}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={isApprove ? 'success' : 'warning'}
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {confirmButtonLabel({ action, count, isLoading, t })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function confirmationText({
  action,
  count,
  t,
}: {
  action: BatchAction;
  count: number;
  t: T;
}): string {
  const isOne = count === 1;
  if (action === 'approve') {
    return isOne
      ? t('imports.batch.confirmApprove.one')
      : t('imports.batch.confirmApprove.other', { count });
  }
  return isOne
    ? t('imports.batch.confirmIgnore.one')
    : t('imports.batch.confirmIgnore.other', { count });
}

function confirmButtonLabel({
  action,
  count,
  isLoading,
  t,
}: {
  action: BatchAction;
  count: number;
  isLoading: boolean;
  t: T;
}): string {
  if (isLoading) {
    return t('imports.batch.processing');
  }
  return action === 'approve'
    ? t('imports.batch.approveCount', { count })
    : t('imports.batch.ignoreCount', { count });
}
