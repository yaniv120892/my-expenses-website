'use client';

import { useState } from 'react';
import { Alert } from '@mui/material';
import FixedExpensesSummary from '@/components/FixedExpensesSummary';
import PendingTransactionsList from '@/components/PendingTransactionsList';
import PendingTransactionListSkeleton from '@/components/PendingTransactionListSkeleton';
import NotificationSnackbar from '@/components/NotificationSnackbar';
import { PageHeader } from '@yaniv120892/my-ui';
import { useCanWrite } from '@/hooks/useSession';
import { describeApiError } from '@/utils/api';
import {
  usePendingTransactionsQuery,
  useConfirmTransactionMutation,
  useDeletePendingTransactionMutation,
} from '@/hooks/usePendingTransactionsQuery';
import { useScheduledTransactionsQuery } from '@/hooks/useScheduledTransactionsQuery';
import { useT } from '@/i18n/useT';

type Notice = { message: string; severity: 'success' | 'error' };

export default function PendingPage() {
  const t = useT();
  const canWrite = useCanWrite();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  // Remounts the snackbar per notice, restarting its auto-hide timer and
  // entry animation for rapid consecutive outcomes.
  const [noticeKey, setNoticeKey] = useState(0);

  function showNotice(next: Notice) {
    setNotice(next);
    setNoticeOpen(true);
    setNoticeKey((key) => key + 1);
  }
  const {
    data: pendingTransactions = [],
    isLoading,
    isError: loadFailed,
  } = usePendingTransactionsQuery();
  const { data: scheduledTransactions = [] } = useScheduledTransactionsQuery();
  const confirmMutation = useConfirmTransactionMutation();
  const deleteMutation = useDeletePendingTransactionMutation();

  async function runWithNotice({
    action,
    successMessage,
    failureMessage,
  }: {
    action: () => Promise<unknown>;
    successMessage: string;
    failureMessage: string;
  }) {
    try {
      await action();
      showNotice({ message: successMessage, severity: 'success' });
    } catch (error) {
      showNotice({
        message: describeApiError(error, failureMessage),
        severity: 'error',
      });
    }
  }

  const handleConfirm = (id: string) =>
    runWithNotice({
      action: () => confirmMutation.mutateAsync(id),
      successMessage: t('pending.approved'),
      failureMessage: t('pending.approveFailed'),
    });

  const handleDelete = (id: string) =>
    runWithNotice({
      action: () => deleteMutation.mutateAsync(id),
      successMessage: t('pending.rejected'),
      failureMessage: t('pending.rejectFailed'),
    });

  return (
    <>
      <PageHeader title={t('pending.title')} subtitle={t('pending.subtitle')} />
      <FixedExpensesSummary scheduledTransactions={scheduledTransactions} today={new Date()} />
      {isLoading ? (
        <PendingTransactionListSkeleton rows={6} />
      ) : loadFailed ? (
        <Alert severity="error">{t('pending.loadFailed')}</Alert>
      ) : (
        <PendingTransactionsList
          transactions={pendingTransactions}
          onConfirmAction={handleConfirm}
          onDeleteAction={handleDelete}
          readOnly={!canWrite}
        />
      )}
      <NotificationSnackbar
        key={noticeKey}
        open={noticeOpen}
        message={notice?.message ?? ''}
        severity={notice?.severity}
        onClose={() => setNoticeOpen(false)}
      />
    </>
  );
}
