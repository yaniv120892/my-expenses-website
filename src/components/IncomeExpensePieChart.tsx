'use client';

import React from 'react';
import { Box, Paper, Skeleton, Stack, Typography, useTheme } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import type { TransactionType } from '@/types';
import { UNSELECTED_SLICE_OPACITY, CLICKABLE_SLICE_SX } from '@/components/chartStyles';

type PieDatum = {
  name: string;
  value: number;
  type: TransactionType;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: readonly { payload?: PieDatum }[];
};

type Props = {
  income: number;
  expense: number;
  loading?: boolean;
  error?: boolean;
  title?: string;
  selectedType?: TransactionType;
  onSelectType?: (type: TransactionType) => void;
};

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  const formatter = useAppFormat();
  const datum = payload?.[0]?.payload;
  if (!active || !datum) {
    return null;
  }
  const { name, value } = datum;
  return (
    <Paper variant="outlined" sx={{ px: 1, py: 0.5, whiteSpace: 'nowrap' }}>
      <Typography variant="caption">
        <Box component="span" sx={{ fontWeight: 600 }}>
          {name}:
        </Box>{' '}
        {formatter.currency(value)}
      </Typography>
    </Paper>
  );
}

export default function IncomeExpensePieChart({
  income,
  expense,
  loading,
  error,
  title,
  selectedType,
  onSelectType,
}: Props) {
  const t = useT();
  const formatter = useAppFormat();
  const theme = useTheme();
  const palette = (theme.vars ?? theme).palette;
  const { charts } = palette;
  const pieData: PieDatum[] = [
    { name: t('common.income'), value: income, type: 'INCOME' },
    { name: t('common.expense'), value: expense, type: 'EXPENSE' },
  ];
  const pieColors = [charts.positive, charts.negative];
  const total = income - expense;

  function selectSlice(_slice: unknown, index: number) {
    const slice = pieData[index];
    if (slice) {
      onSelectType?.(slice.type);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
      {title && (
        <Typography variant="h5" sx={{ mb: 1.5 }}>
          {title}
        </Typography>
      )}
      <Stack
        direction="row"
        spacing={3}
        sx={{
          alignItems: 'center',
        }}
      >
        {loading ? (
          <>
            <Skeleton variant="circular" width={130} height={130} />
            <Stack spacing={1} sx={{ minWidth: 120 }}>
              <Skeleton width={90} />
              <Skeleton width={90} />
              <Skeleton width={90} />
            </Stack>
          </>
        ) : error ? (
          <Typography
            variant="body2"
            sx={{
              color: 'error.main',
            }}
          >
            {t('dashboard.incomeExpense.loadFailed')}
          </Typography>
        ) : (
          <>
            <Box
              sx={{
                width: 130,
                height: 130,
                flexShrink: 0,
                ...(onSelectType && CLICKABLE_SLICE_SX),
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={62}
                    innerRadius={38}
                    stroke={palette.background.paper}
                    strokeWidth={2}
                    startAngle={90}
                    endAngle={-270}
                    onClick={onSelectType ? selectSlice : undefined}
                  >
                    {pieData.map((entry, entryIndex) => (
                      <Cell
                        key={entry.type}
                        fill={pieColors[entryIndex % pieColors.length]}
                        fillOpacity={
                          selectedType && selectedType !== entry.type ? UNSELECTED_SLICE_OPACITY : 1
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip content={ChartTooltip} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {t('dashboard.incomeExpense.incomeLabel')}{' '}
                <Box component="span" sx={{ color: charts.positive, fontWeight: 600 }}>
                  {formatter.currency(income)}
                </Box>
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {t('dashboard.incomeExpense.expensesLabel')}{' '}
                <Box component="span" sx={{ color: charts.negative, fontWeight: 600 }}>
                  {formatter.currency(expense)}
                </Box>
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  color: total >= 0 ? charts.positive : charts.negative,
                }}
              >
                {t('dashboard.incomeExpense.total', {
                  amount: formatter.currency(Math.abs(Math.round(total))),
                })}
              </Typography>
            </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
}
