'use client';

import { Box, Paper, Stack, Typography, useTheme } from '@mui/material';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CategoryBreakdownView } from '@/shared/types/chat';
import { formatCurrency } from '@/utils/format';
import BlockShell from '@/components/chat/blocks/BlockShell';

/** Beyond this the donut becomes unreadable slivers; the rest roll up. */
const MAX_SLICES = 6;

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const { name, value } = payload[0];

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

export default function CategoryBreakdownBlock({
  view,
}: {
  view: CategoryBreakdownView;
}) {
  const theme = useTheme();
  const seriesColors = theme.palette.charts.series;

  if (!view.slices.length) {
    return null;
  }

  const visible = view.slices.slice(0, MAX_SLICES);
  const remainder = view.slices.slice(MAX_SLICES);

  const slices = remainder.length
    ? [
        ...visible,
        {
          categoryName: `Other (${remainder.length})`,
          amount: remainder.reduce((sum, slice) => sum + slice.amount, 0),
          percentage: remainder.reduce(
            (sum, slice) => sum + slice.percentage,
            0,
          ),
        },
      ]
    : visible;

  const chartData = slices.map((slice) => ({
    name: slice.categoryName,
    value: slice.amount,
  }));

  return (
    <BlockShell title={view.title ?? 'Spending by category'}>
      <Box sx={{ width: '100%', height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={78}
              innerRadius={44}
              stroke={theme.palette.background.paper}
              strokeWidth={2}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={index}
                  fill={seriesColors[index % seriesColors.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </Box>

      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {slices.map((slice, index) => (
          <Stack
            key={slice.categoryName}
            direction="row"
            alignItems="center"
            spacing={1}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: seriesColors[index % seriesColors.length],
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" sx={{ flex: 1 }} noWrap dir="auto">
              {slice.categoryName}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {formatCurrency(slice.amount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ({slice.percentage.toFixed(1)}%)
            </Typography>
          </Stack>
        ))}
      </Stack>
    </BlockShell>
  );
}
