'use client';

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { MonthComparison, TopCategory } from '@/types/dashboard';
import { formatNumber } from '@/utils/format';

interface Props {
  comparison: MonthComparison;
  categories: TopCategory[];
}

function SpendingBar({
  label,
  value,
  max,
  barColor,
}: {
  label: string;
  value: number;
  max: number;
  barColor: string;
}) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {formatNumber(value)}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={(value / max) * 100}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: 'action.selected',
          '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 4 },
        }}
      />
    </Box>
  );
}

export function MonthHighlights({ comparison, categories }: Props) {
  const theme = useTheme();
  const { charts } = theme.palette;
  const { currentMonth, previousMonth } = comparison;
  const maxExpense = Math.max(
    currentMonth.totalExpense,
    previousMonth.totalExpense,
    1,
  );

  const sortedByChange = [...categories].sort(
    (a, b) => b.change.percentage - a.change.percentage,
  );
  const biggestIncrease = sortedByChange.find((c) => c.change.trend === 'up');
  const biggestDecrease = [...sortedByChange]
    .reverse()
    .find((c) => c.change.trend === 'down');

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Month Highlights
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Spending Comparison
        </Typography>
        <Stack spacing={1.5} sx={{ mb: 2.5 }}>
          <SpendingBar
            label="This Month"
            value={currentMonth.totalExpense}
            max={maxExpense}
            barColor={charts.expense}
          />
          <SpendingBar
            label="Last Month"
            value={previousMonth.totalExpense}
            max={maxExpense}
            barColor={theme.palette.primary.main}
          />
        </Stack>

        {biggestIncrease && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Biggest Increase
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, color: charts.expense }}
            >
              {biggestIncrease.categoryName}: +
              {Math.abs(biggestIncrease.change.percentage).toFixed(1)}%
            </Typography>
          </Box>
        )}

        {biggestDecrease && (
          <Box>
            <Typography variant="body2" color="text.secondary">
              Biggest Decrease
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, color: charts.income }}
            >
              {biggestDecrease.categoryName}:{' '}
              {biggestDecrease.change.percentage.toFixed(1)}%
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
