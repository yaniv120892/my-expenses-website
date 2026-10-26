'use client';

import { Typography, type TypographyProps } from '@mui/material';
import { useAppFormat } from '@/i18n/useAppFormat';

const PERCENT_DIGITS = { minimumFractionDigits: 1, maximumFractionDigits: 1 };

export function ChangeFromPrevious({
  percentageChange,
  variant,
}: {
  percentageChange: number;
  variant: TypographyProps['variant'];
}) {
  const formatter = useAppFormat();
  return (
    <Typography
      variant={variant}
      sx={{ color: percentageChange > 0 ? 'error.main' : 'success.main' }}
    >
      {formatter.percent(percentageChange / 100, {
        ...PERCENT_DIGITS,
        signDisplay: 'exceptZero',
      })}
    </Typography>
  );
}
