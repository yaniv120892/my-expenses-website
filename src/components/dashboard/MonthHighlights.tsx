'use client';

import React from 'react';
import { Box, Card, CardContent, LinearProgress, Stack, Typography, useTheme } from '@mui/material';
import { MonthComparison, TopCategory } from '@/types/dashboard';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';

type Props = {
  comparison: MonthComparison;
  categories: TopCategory[];
};

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
  const formatter = useAppFormat();
  return (
    <Box>
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          mb: 0.5,
        }}
      >
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {formatter.number({ value })}
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
  const t = useT();
  const formatter = useAppFormat();
  const theme = useTheme();
  const palette = (theme.vars ?? theme).palette;
  const { charts } = palette;
  const { currentMonth, previousMonth } = comparison;
  const maxExpense = Math.max(currentMonth.totalExpense, previousMonth.totalExpense, 1);

  const sortedByChange = [...categories].sort((a, b) => b.change.percentage - a.change.percentage);
  const biggestIncrease = sortedByChange.find((c) => c.change.trend === 'up');
  const biggestDecrease = [...sortedByChange].reverse().find((c) => c.change.trend === 'down');

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          {t('dashboard.highlights.title')}
        </Typography>

        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mb: 1,
          }}
        >
          {t('dashboard.highlights.spendingComparison')}
        </Typography>
        <Stack spacing={1.5} sx={{ mb: 2.5 }}>
          <SpendingBar
            label={t('dashboard.highlights.thisMonth')}
            value={currentMonth.totalExpense}
            max={maxExpense}
            barColor={charts.negative}
          />
          <SpendingBar
            label={t('dashboard.highlights.lastMonth')}
            value={previousMonth.totalExpense}
            max={maxExpense}
            barColor={palette.primary.main}
          />
        </Stack>

        {biggestIncrease && (
          <Box sx={{ mb: 1 }}>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t('dashboard.highlights.biggestIncrease')}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: charts.negative }}>
              {t('dashboard.highlights.categoryChange', {
                category: biggestIncrease.categoryName,
                change: formatter.percentagePoints(Math.abs(biggestIncrease.change.percentage), {
                  signDisplay: 'always',
                }),
              })}
            </Typography>
          </Box>
        )}

        {biggestDecrease && (
          <Box>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t('dashboard.highlights.biggestDecrease')}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: charts.positive }}>
              {t('dashboard.highlights.categoryChange', {
                category: biggestDecrease.categoryName,
                change: formatter.percentagePoints(biggestDecrease.change.percentage),
              })}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
