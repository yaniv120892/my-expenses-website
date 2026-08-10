'use client';

import React from 'react';
import ListSkeleton from './ListSkeleton';

const COLUMNS = ['Description', 'Category', 'Date', 'Amount', 'Actions'];

export default function PendingTransactionListSkeleton({
  rows = 5,
}: {
  rows?: number;
}) {
  return <ListSkeleton columns={COLUMNS} rows={rows} />;
}
