'use client';

import { Box, Paper, Stack, Typography, useTheme } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CategoryComparison,
  ComparisonMeasure,
  TrendPeriod,
} from '@/types/trends';
import { formatCurrency, formatNumber } from '@/utils/format';
import {
  formatBucketLabel,
  selectMeasure,
  seriesColor,
} from '@/utils/comparison';
import { useIsMobile } from '@/hooks/useBreakpoints';

export type ComparisonChartMode = 'grouped' | 'stacked' | 'lines';

interface Props {
  comparison: CategoryComparison;
  measure: ComparisonMeasure;
  mode: ComparisonChartMode;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <Paper variant="outlined" sx={{ px: 1.25, py: 0.75 }}>
      <Typography variant="caption" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Stack spacing={0.25} sx={{ mt: 0.5 }}>
        {payload.map((entry) => (
          <Stack
            key={entry.name}
            direction="row"
            spacing={1}
            alignItems="center"
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: entry.color,
                flexShrink: 0,
              }}
            />
            <Typography variant="caption" sx={{ flex: 1 }}>
              {entry.name}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {formatCurrency(entry.value)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

function buildChartRows(
  comparison: CategoryComparison,
  measure: ComparisonMeasure,
  period: TrendPeriod,
) {
  return comparison.buckets.map((bucket) => {
    const row: Record<string, string | number> = {
      label: formatBucketLabel(bucket, period),
    };
    comparison.series.forEach((series, index) => {
      row[series.categoryId] = selectMeasure(bucket.cells[index], measure);
    });
    return row;
  });
}

export function ComparisonChart({ comparison, measure, mode }: Props) {
  const theme = useTheme();
  const isMobile = useIsMobile();
  const palette = (theme.vars ?? theme).palette;
  const seriesColors = palette.charts.series;
  const rows = buildChartRows(comparison, measure, comparison.period);

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={palette.divider} />
      {/* Not reversed: a comparison reads left to right chronologically. */}
      <XAxis
        dataKey="label"
        tick={{ fill: palette.text.secondary, fontSize: 12 }}
      />
      <YAxis
        tickFormatter={(value: number) => formatNumber(value)}
        tick={{ fill: palette.text.secondary, fontSize: 12 }}
        width={72}
      />
      <Tooltip content={<ChartTooltip />} />
      {!isMobile && <Legend />}
    </>
  );

  return (
    <Box sx={{ width: '100%', height: { xs: 260, md: 360 } }}>
      <ResponsiveContainer width="100%" height="100%">
        {mode === 'lines' ? (
          <LineChart data={rows}>
            {axes}
            {comparison.series.map((series, index) => (
              <Line
                key={series.categoryId}
                type="monotone"
                dataKey={series.categoryId}
                name={series.categoryName}
                stroke={seriesColor(index, seriesColors)}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : (
          <BarChart data={rows}>
            {axes}
            {comparison.series.map((series, index) => (
              <Bar
                key={series.categoryId}
                dataKey={series.categoryId}
                name={series.categoryName}
                fill={seriesColor(index, seriesColors)}
                stackId={mode === 'stacked' ? 'comparison' : undefined}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </Box>
  );
}
