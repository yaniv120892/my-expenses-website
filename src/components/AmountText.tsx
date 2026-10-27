'use client';

import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { isForeignCurrency } from '@/shared/currency';
import { TypographyProps } from '@mui/material/Typography';
import { TransactionType } from '../types';
import { useAppFormat } from '@/i18n/useAppFormat';

type Props = {
  value: number;
  type: TransactionType;
  variant?: TypographyProps['variant'];
  fontWeight?: React.CSSProperties['fontWeight'];
  /** 'signed' renders a plain number prefixed with + or - instead of a currency amount. */
  format?: 'currency' | 'signed';
  /** Shown under the ILS amount when the charge was in another currency. */
  original?: { currency: string; originalAmount: number };
};

export default function AmountText({
  value,
  type,
  variant = 'body2',
  fontWeight = 600,
  format = 'currency',
  original,
}: Props) {
  const theme = useTheme();
  const formatter = useAppFormat();
  const palette = (theme.vars ?? theme).palette;

  const amount = (
    <Typography
      variant={variant}
      sx={{
        fontWeight,
        whiteSpace: 'nowrap',
        color: type === 'INCOME' ? palette.charts.positive : palette.charts.negative,
      }}
    >
      {format === 'currency'
        ? formatter.currency(value)
        : formatter.number({
            value: type === 'INCOME' ? value : -value,
            options: { signDisplay: 'always' },
          })}
    </Typography>
  );
  const showsOriginal = original && isForeignCurrency(original.currency);
  if (!showsOriginal) {
    return amount;
  }
  return (
    <Box sx={{ textAlign: 'right' }}>
      {amount}
      <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
        {formatter.money(original.originalAmount, original.currency)}
      </Typography>
    </Box>
  );
}
