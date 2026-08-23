'use client';

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { TopCategory } from '@/types/dashboard';
import { formatNumber } from '@/utils/format';
import { CLICKABLE_SLICE_SX } from '@/components/chartStyles';

interface Props {
  categories: TopCategory[];
  onSelectCategory?: (categoryId: string) => void;
}

const CLICKABLE_ROW_SX = {
  cursor: 'pointer',
  borderRadius: 1,
  px: 0.5,
  mx: -0.5,
  '&:hover': { bgcolor: 'action.hover' },
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
}) {
  if (!active || !payload || !payload.length) {
    return null;
  }
  const { name, value } = payload[0];
  return (
    <Paper variant="outlined" sx={{ px: 1, py: 0.5, whiteSpace: 'nowrap' }}>
      <Typography variant="caption">
        <Box component="span" sx={{ fontWeight: 600 }}>
          {name}:
        </Box>{' '}
        {formatNumber(value)}
      </Typography>
    </Paper>
  );
}

function CategoryTrendIcon({
  trend,
}: {
  trend: TopCategory['change']['trend'];
}) {
  // Spending semantics: an upward-trending expense category is the bad case.
  if (trend === 'up') {
    return <TrendingUpIcon fontSize="small" color="error" />;
  }
  if (trend === 'down') {
    return <TrendingDownIcon fontSize="small" color="success" />;
  }
  return <TrendingFlatIcon fontSize="small" color="disabled" />;
}

export function TopCategoriesChart({ categories, onSelectCategory }: Props) {
  const theme = useTheme();
  const seriesColors = theme.palette.charts.series;

  if (!categories.length) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Top Categories
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No expense data yet
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const chartData = categories.map((c) => ({
    name: c.categoryName,
    value: c.amount,
  }));

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Top Categories
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: '100%',
              height: 220,
              minWidth: 0,
              flex: 1,
              ...(onSelectCategory && CLICKABLE_SLICE_SX),
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  stroke={theme.palette.background.paper}
                  strokeWidth={2}
                  onClick={
                    onSelectCategory
                      ? (_, index) =>
                          onSelectCategory(categories[index].categoryId)
                      : undefined
                  }
                >
                  {chartData.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={seriesColors[idx % seriesColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </Box>
          <Stack
            spacing={1}
            sx={{ minWidth: { md: 220 }, width: { xs: '100%', md: 'auto' } }}
          >
            {categories.map((cat, idx) => (
              <Stack
                key={cat.categoryId}
                direction="row"
                alignItems="center"
                spacing={1}
                onClick={
                  onSelectCategory
                    ? () => onSelectCategory(cat.categoryId)
                    : undefined
                }
                sx={onSelectCategory ? CLICKABLE_ROW_SX : undefined}
              >
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: seriesColors[idx % seriesColors.length],
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                  {cat.categoryName}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatNumber(cat.amount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ({cat.percentage.toFixed(1)}%)
                </Typography>
                <CategoryTrendIcon trend={cat.change.trend} />
              </Stack>
            ))}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
