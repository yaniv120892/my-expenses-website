'use client';

import React from 'react';
import ListSkeleton from './ListSkeleton';
import { useT } from '@/i18n/useT';

export default function PendingTransactionListSkeleton({ rows = 5 }: { rows?: number }) {
  const t = useT();
  const columns = [
    t('pending.column.description'),
    t('pending.column.category'),
    t('pending.column.date'),
    t('pending.column.amount'),
    t('pending.column.actions'),
  ];
  return <ListSkeleton columns={columns} rows={rows} alignEndCount={2} />;
}
