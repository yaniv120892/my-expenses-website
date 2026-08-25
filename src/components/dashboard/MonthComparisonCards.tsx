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
import { formatNumber } from '@/utils/format';

interface Props {
  comparison: MonthComparison;
}

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
  const theme = useTheme();
  const { charts } = theme.palette;

  const getChangeColor = () => {
    if (change.trend === 'stable') {
      return theme.palette.text.secondary;
    }
    if (invertColors) {
      return change.trend === 'up' ? charts.expense : charts.income;
    }
    return change.trend === 'up' ? charts.income : charts.expense;
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
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h3" component="p">
          {formatNumber(value)}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1 }}>
          <TrendGlyph fontSize="small" sx={{ color }} />
          <Typography variant="body2" sx={{ color, fontWeight: 600 }}>
            {Math.abs(change.percentage).toFixed(1)}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            vs last month
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function MonthComparisonCards({ comparison }: Props) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        gap: 2,
      }}
    >
      <ComparisonCard
        title="Income"
        value={comparison.currentMonth.totalIncome}
        change={comparison.incomeChange}
      />
      <ComparisonCard
        title="Expenses"
        value={comparison.currentMonth.totalExpense}
        change={comparison.expenseChange}
        invertColors
      />
      <ComparisonCard
        title="Savings"
        value={comparison.currentMonth.savings}
        change={comparison.savingsChange}
      />
    </Box>
  );
}
