'use client';

import { Box, Chip, Typography } from '@mui/material';
import { TransactionType } from '@/types';
import { formatTransactionDate } from '@/utils/format';
import AmountText from '@/components/AmountText';

export interface TransactionRowProps {
  description: string;
  value: number;
  /** ISO date string. */
  date: string;
  type: TransactionType;
  categoryName: string;
  /** 'signed' matches the dashboard's compact +/- styling. */
  amountFormat?: 'currency' | 'signed';
  divider?: boolean;
}

/**
 * One transaction as a compact row: description, date, category, amount.
 *
 * Shared by the dashboard quick view and the assistant's chat replies so a
 * transaction looks the same wherever it is listed.
 */
export default function TransactionRow({
  description,
  value,
  date,
  type,
  categoryName,
  amountFormat = 'signed',
  divider = true,
}: TransactionRowProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 0.5,
        ...(divider ? { borderBottom: 1, borderColor: 'divider' } : {}),
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* dir="auto" so Hebrew descriptions read right-to-left while the
            surrounding layout stays put. */}
        <Typography variant="body2" fontWeight={600} noWrap dir="auto">
          {description}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {formatTransactionDate(date)}
          </Typography>
          <Chip
            label={categoryName}
            size="small"
            sx={{ height: 20, fontSize: 11, maxWidth: 160 }}
          />
        </Box>
      </Box>
      <AmountText
        type={type}
        value={value}
        fontWeight={700}
        format={amountFormat}
      />
    </Box>
  );
}
