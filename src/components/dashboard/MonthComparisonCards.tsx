'use client';

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { MonthComparison, PercentageChange } from '@/types/dashboard';
import { MIRROR_IN_RTL_SX } from '@/components/rtlStyles';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';

type Props = {
  comparison: MonthComparison;
};

function ComparisonCard({
  title,
  value,
  change,
  invertColors = false,
}: {
  title: string;
  value: number;
  change: PercentageChange;
  invertColors?: boolean;
}) {
  const t = useT();
  const formatter = useAppFormat();
  const theme = useTheme();
  const palette = (theme.vars ?? theme).palette;
  const { charts } = palette;

  const getChangeColor = () => {
    if (change.trend === 'stable') {
      return palette.text.secondary;
    }
    if (invertColors) {
      return change.trend === 'up' ? charts.negative : charts.positive;
    }
    return change.trend === 'up' ? charts.positive : charts.negative;
  };

  const color = getChangeColor();
  const TrendGlyph =
    change.trend === 'up'
      ? TrendingUpIcon
      : change.trend === 'down'
        ? TrendingDownIcon
        : TrendingFlatIcon;

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography
          variant="body2"
          gutterBottom
          sx={{
            color: 'text.secondary',
          }}
        >
          {title}
        </Typography>
        <Typography variant="h3" component="p">
          {formatter.number(value)}
        </Typography>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            alignItems: 'center',
            mt: 1,
          }}
        >
          <TrendGlyph fontSize="small" sx={{ color, ...MIRROR_IN_RTL_SX }} />
          <Typography variant="body2" sx={{ color, fontWeight: 600 }}>
            {formatter.percentagePoints(Math.abs(change.percentage))}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            {t('dashboard.comparison.vsLastMonth')}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function MonthComparisonCards({ comparison }: Props) {
  const t = useT();
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        gap: 2,
      }}
    >
      <ComparisonCard
        title={t('common.incomePlural')}
        value={comparison.currentMonth.totalIncome}
        change={comparison.incomeChange}
      />
      <ComparisonCard
        title={t('common.expensePlural')}
        value={comparison.currentMonth.totalExpense}
        change={comparison.expenseChange}
        invertColors
      />
      <ComparisonCard
        title={t('dashboard.comparison.savings')}
        value={comparison.currentMonth.savings}
        change={comparison.savingsChange}
      />
    </Box>
  );
}
