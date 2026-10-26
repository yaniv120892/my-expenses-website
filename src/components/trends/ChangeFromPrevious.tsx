'use client';

import { Typography, type TypographyProps } from '@mui/material';
import { useAppFormat } from '@/i18n/useAppFormat';

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
      {formatter.percentagePoints(percentageChange, {
        signDisplay: 'exceptZero',
      })}
    </Typography>
  );
}
