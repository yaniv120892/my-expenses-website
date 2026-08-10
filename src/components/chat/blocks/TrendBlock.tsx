'use client';

import { Box, Paper, Stack, Typography, useTheme } from '@mui/material';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendView } from '@/shared/types/chat';
import { formatCurrency, formatNumber } from '@/utils/format';
import BlockShell from '@/components/chat/blocks/BlockShell';

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <Paper variant="outlined" sx={{ px: 1, py: 0.5, whiteSpace: 'nowrap' }}>
      <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="caption">
        {formatCurrency(payload[0].value)}
      </Typography>
    </Paper>
  );
}

export default function TrendBlock({ view }: { view: TrendView }) {
  const theme = useTheme();

  if (!view.points.length) {
    return null;
  }

  const changeColor =
    view.percentageChange === null
      ? theme.palette.text.secondary
      : view.percentageChange > 0
        ? theme.palette.charts.expense
        : theme.palette.charts.income;

  return (
    <BlockShell title={view.title ?? `Spending trend (${view.period})`}>
      <Box sx={{ width: '100%', height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={view.points}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={theme.palette.divider}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
              tickLine={false}
              minTickGap={16}
            />
            <YAxis
              tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(value: number) => formatNumber(value)}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="amount"
              stroke={theme.palette.charts.series[0]}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mt: 1 }}
      >
        <Typography variant="caption" color="text.secondary">
          Total
        </Typography>
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {formatCurrency(view.totalAmount)}
          </Typography>
          {view.percentageChange !== null && (
            <Typography variant="caption" sx={{ color: changeColor }}>
              {view.percentageChange >= 0 ? '+' : ''}
              {view.percentageChange}%
            </Typography>
          )}
        </Stack>
      </Stack>
    </BlockShell>
  );
}
