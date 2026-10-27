'use client';

import { MenuItem, TextField } from '@mui/material';
import type { TransactionSort } from '@/shared/schemas/transactions';
import { useT } from '@/i18n/useT';

const SORT_OPTIONS: TransactionSort[] = [
  { sortBy: 'date', sortOrder: 'desc' },
  { sortBy: 'date', sortOrder: 'asc' },
  { sortBy: 'amount', sortOrder: 'desc' },
  { sortBy: 'amount', sortOrder: 'asc' },
  { sortBy: 'category', sortOrder: 'asc' },
  { sortBy: 'category', sortOrder: 'desc' },
];

const optionKey = ({ sortBy, sortOrder }: TransactionSort) => `${sortBy}-${sortOrder}` as const;

export function TransactionSortSelect({
  value,
  onChange,
}: {
  value: TransactionSort;
  onChange: (sort: TransactionSort) => void;
}) {
  const t = useT();
  return (
    <TextField
      select
      size="small"
      label={t('transactions.sort.label')}
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
          {t(`transactions.sort.${optionKey(option)}`)}
        </MenuItem>
      ))}
    </TextField>
  );
}
