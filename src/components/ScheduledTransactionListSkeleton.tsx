'use client';

import React from 'react';
import ListSkeleton from './ListSkeleton';
import { useT } from '@/i18n/useT';

export default function ScheduledTransactionListSkeleton({ rows = 5 }: { rows?: number }) {
  const t = useT();
  const columns = [
    t('scheduled.column.description'),
    t('scheduled.column.category'),
    t('scheduled.column.schedule'),
    t('scheduled.column.nextRun'),
    t('scheduled.column.amount'),
  ];
  return <ListSkeleton columns={columns} rows={rows} mobileLines={3} />;
}
