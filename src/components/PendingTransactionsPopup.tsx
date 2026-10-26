'use client';
import React, { useEffect, useState } from 'react';
import NotificationSnackbar from './NotificationSnackbar';
import { usePendingTransactionsQuery } from '../hooks/usePendingTransactionsQuery';
import { useT } from '@/i18n/useT';

const STORAGE_KEY = 'pendingTransactionsSeenDate';

function getTodayKey() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export default function PendingTransactionsPopup() {
  const t = useT();
  const { data: pendingTransactions = [] } = usePendingTransactionsQuery();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pendingTransactions.length > 0) {
      const today = getTodayKey();
      const seenDate = localStorage.getItem(STORAGE_KEY);
      if (seenDate !== today) {
        setOpen(true);
        localStorage.setItem(STORAGE_KEY, today);
      }
    }
  }, [pendingTransactions.length]);

  const handleClose = () => setOpen(false);

  if (pendingTransactions.length === 0) {
    return null;
  }

  return (
    <NotificationSnackbar
      open={open}
      message={
        pendingTransactions.length === 1
          ? t('pending.popup.one')
          : t('pending.popup.other', { count: pendingTransactions.length })
      }
      severity="info"
      onClose={handleClose}
      autoHideDuration={6000}
    />
  );
}
