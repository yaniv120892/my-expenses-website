'use client';

import React from 'react';
import { Typography, useTheme } from '@mui/material';
import { TypographyProps } from '@mui/material/Typography';
import { TransactionType } from '../types';
import { formatCurrency, formatNumber } from '../utils/format';

type Props = {
  value: number;
  type: TransactionType;
  variant?: TypographyProps['variant'];
  fontWeight?: TypographyProps['fontWeight'];
  /** 'signed' renders a plain number prefixed with + or - instead of a currency amount. */
  format?: 'currency' | 'signed';
};

export default function AmountText({
  value,
  type,
  variant = 'body2',
  fontWeight = 600,
  format = 'currency',
}: Props) {
  const theme = useTheme();
  // theme.vars, not theme.palette: with cssVariables the palette holds the
  // light scheme's literals, and only the var() references track dark mode.
  const { charts } = (theme.vars ?? theme).palette;

  return (
    <Typography
      variant={variant}
      sx={{
        fontWeight,
        whiteSpace: 'nowrap',
        color: type === 'INCOME' ? charts.income : charts.expense,
      }}
    >
      {format === 'currency'
        ? formatCurrency(value)
        : `${type === 'INCOME' ? '+' : '-'}${formatNumber(value)}`}
    </Typography>
  );
}
