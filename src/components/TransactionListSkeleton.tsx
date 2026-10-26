'use client';

import React from 'react';
import ListSkeleton from './ListSkeleton';
import { useT } from '@/i18n/useT';

export default function TransactionListSkeleton({
  rows = 5,
}: {
  rows?: number;
}) {
  const t = useT();
  const columns = [
    t('common.description'),
    t('common.category'),
    t('common.date'),
    t('common.amount'),
  ];
  return <ListSkeleton columns={columns} rows={rows} />;
}
