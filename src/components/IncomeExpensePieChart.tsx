'use client';

import React from 'react';
import {
  Box,
  Paper,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { TooltipProps } from 'recharts';
import { formatCurrency } from '@/utils/format';
import { TransactionType } from '@/types';
import { CLICKABLE_SLICE_SX } from '@/components/chartStyles';

interface PieTooltipPayload {
  name: string;
  value: number;
}

interface PieDatum {
  name: string;
  value: number;
  type: TransactionType;
}

interface Props {
  income: number;
  expense: number;
  loading?: boolean;
  error?: string | null;
  title?: string;
  selectedType?: TransactionType;
  onSelectType?: (type: TransactionType) => void;
}

const UNSELECTED_SLICE_OPACITY = 0.3;

function ChartTooltip({
  active,
  payload,
}: Pick<TooltipProps<number, string>, 'active' | 'payload'>) {
  if (!active || !payload || !payload.length) {
    return null;
  }
  const { name, value } = payload[0] as PieTooltipPayload;
  return (
    <Paper variant="outlined" sx={{ px: 1, py: 0.5, whiteSpace: 'nowrap' }}>
      <Typography variant="caption">
        <Box component="span" sx={{ fontWeight: 600 }}>
          {name}:
        </Box>{' '}
        {formatCurrency(value)}
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
  const theme = useTheme();
  const { charts } = theme.palette;
  const pieData: PieDatum[] = [
    { name: 'Income', value: income, type: 'INCOME' },
    { name: 'Expense', value: expense, type: 'EXPENSE' },
  ];
  const pieColors = [charts.income, charts.expense];
  const total = income - expense;

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
      {title && (
        <Typography variant="h5" sx={{ mb: 1.5 }}>
          {title}
        </Typography>
      )}
      <Stack direction="row" alignItems="center" spacing={3}>
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
          <Typography color="error.main" variant="body2">
            Failed to load summary
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
                    stroke={theme.palette.background.paper}
                    strokeWidth={2}
                    startAngle={90}
                    endAngle={-270}
                    onClick={
                      onSelectType
                        ? (_, index) => onSelectType(pieData[index].type)
                        : undefined
                    }
                  >
                    {pieData.map((entry, idx) => (
                      <Cell
                        key={entry.name}
                        fill={pieColors[idx % pieColors.length]}
                        fillOpacity={
                          selectedType && selectedType !== entry.type
                            ? UNSELECTED_SLICE_OPACITY
                            : 1
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              <Typography variant="body2" color="text.secondary">
                Income:{' '}
                <Box
                  component="span"
                  sx={{ color: charts.income, fontWeight: 600 }}
                >
                  {formatCurrency(income)}
                </Box>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Expenses:{' '}
                <Box
                  component="span"
                  sx={{ color: charts.expense, fontWeight: 600 }}
                >
                  {formatCurrency(expense)}
                </Box>
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  color: total >= 0 ? charts.income : charts.expense,
                }}
              >
                Total: {formatCurrency(Math.abs(Math.round(total)))}
              </Typography>
            </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
}
