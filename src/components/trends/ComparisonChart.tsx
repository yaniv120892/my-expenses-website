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
import type { CategoryComparison, ComparisonMeasure } from '@/types/trends';
import { localeDirection, useI18n } from '@yaniv120892/my-ui';
import { useAppFormat, type AppFormatter } from '@/i18n/useAppFormat';
import { formatBucketLabel, selectMeasure, seriesColor } from '@/utils/comparison';
import { useIsMobile } from '@/hooks/useBreakpoints';
import { valueAxisOrientation } from './trendFilters';

export const COMPARISON_CHART_MODES = ['grouped', 'stacked', 'lines'] as const;

export type ComparisonChartMode = (typeof COMPARISON_CHART_MODES)[number];

type Props = {
  comparison: CategoryComparison;
  measure: ComparisonMeasure;
  mode: ComparisonChartMode;
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  const formatter = useAppFormat();
  if (!active || !payload?.length) {
    return null;
  }
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
            sx={{
              alignItems: 'center',
            }}
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
              {formatter.currency(entry.value)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

function buildChartRows({
  comparison,
  measure,
  formatter,
}: {
  comparison: CategoryComparison;
  measure: ComparisonMeasure;
  formatter: AppFormatter;
}) {
  return comparison.buckets.map((bucket) => {
    const row: Record<string, string | number> = {
      label: formatBucketLabel({
        bucket,
        period: comparison.period,
        formatter,
      }),
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
  const formatter = useAppFormat();
  const direction = localeDirection(useI18n().locale);
  const isRightToLeft = direction === 'rtl';
  const palette = (theme.vars ?? theme).palette;
  const seriesColors = palette.charts.series;
  const rows = buildChartRows({ comparison, measure, formatter });

  const tickStyle = { fill: palette.text.secondary, fontSize: 12 };
  // Returned as an array, not a fragment: recharts discovers axes, grid,
  // tooltip and legend by walking its direct children, and it does not
  // traverse into a Fragment — wrapping these hides them entirely.
  const axes = [
    <CartesianGrid key="grid" strokeDasharray="3 3" stroke={palette.divider} />,
    // Buckets arrive oldest first, so time runs in the reading direction.
    <XAxis key="x" dataKey="label" tick={tickStyle} reversed={isRightToLeft} />,
    <YAxis
      key="y"
      tickFormatter={(value: number) => formatter.number({ value })}
      tick={tickStyle}
      width={72}
      orientation={valueAxisOrientation(direction)}
    />,
    <Tooltip key="tooltip" content={<ChartTooltip />} />,
    ...(isMobile ? [] : [<Legend key="legend" />]),
  ];

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
