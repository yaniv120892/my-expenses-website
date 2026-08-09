'use client';

import React from 'react';
import ListSkeleton from './ListSkeleton';

const COLUMNS = ['Description', 'Category', 'Schedule', 'Next run', 'Amount'];

export default function ScheduledTransactionListSkeleton({
  rows = 5,
}: {
  rows?: number;
}) {
  return <ListSkeleton columns={COLUMNS} rows={rows} mobileLines={3} />;
}
