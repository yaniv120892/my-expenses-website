'use client';

import { MenuItem, TextField } from '@mui/material';
import type { TransactionSort } from '@/shared/schemas/transactions';

type SortOption = TransactionSort & { label: string };

const SORT_OPTIONS: SortOption[] = [
  { sortBy: 'date', sortOrder: 'desc', label: 'Newest first' },
  { sortBy: 'date', sortOrder: 'asc', label: 'Oldest first' },
  { sortBy: 'amount', sortOrder: 'desc', label: 'Amount: high to low' },
  { sortBy: 'amount', sortOrder: 'asc', label: 'Amount: low to high' },
  { sortBy: 'category', sortOrder: 'asc', label: 'Category: A to Z' },
  { sortBy: 'category', sortOrder: 'desc', label: 'Category: Z to A' },
];

const optionKey = ({ sortBy, sortOrder }: TransactionSort) =>
  `${sortBy}-${sortOrder}`;

export function TransactionSortSelect({
  value,
  onChange,
}: {
  value: TransactionSort;
  onChange: (sort: TransactionSort) => void;
}) {
  return (
    <TextField
      select
      size="small"
      label="Sort by"
      value={optionKey(value)}
      onChange={(event) => {
        const option = SORT_OPTIONS.find(
          (candidate) => optionKey(candidate) === event.target.value,
        );
        if (option) {
          onChange({ sortBy: option.sortBy, sortOrder: option.sortOrder });
        }
      }}
      sx={{ minWidth: 200 }}
    >
      {SORT_OPTIONS.map((option) => (
        <MenuItem key={optionKey(option)} value={optionKey(option)}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
