'use client';

import React from 'react';
import { Box, Card, CardContent, Paper, Stack, Typography, useTheme } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { TopCategory } from '@/types/dashboard';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import { CLICKABLE_ROW_SX, CLICKABLE_SLICE_SX } from '@/components/chartStyles';
import { MIRROR_IN_RTL_SX } from '@/components/rtlStyles';

type Props = {
  categories: TopCategory[];
  onSelectCategory?: (categoryId: string) => void;
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
}) {
  const formatter = useAppFormat();
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
        {formatter.number({ value })}
      </Typography>
    </Paper>
  );
}

function CategoryTrendIcon({ trend }: { trend: TopCategory['change']['trend'] }) {
  // Spending semantics: an upward-trending expense category is the bad case.
  if (trend === 'up') {
    return <TrendingUpIcon fontSize="small" color="error" sx={MIRROR_IN_RTL_SX} />;
  }
  if (trend === 'down') {
    return <TrendingDownIcon fontSize="small" color="success" sx={MIRROR_IN_RTL_SX} />;
  }
  return <TrendingFlatIcon fontSize="small" color="disabled" sx={MIRROR_IN_RTL_SX} />;
}

export function TopCategoriesChart({ categories, onSelectCategory }: Props) {
  const t = useT();
  const formatter = useAppFormat();
  const theme = useTheme();
  const palette = (theme.vars ?? theme).palette;
  const seriesColors = palette.charts.series;

  if (!categories.length) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          <Typography variant="h5" sx={{ mb: 2 }}>
            {t('dashboard.topCategories.title')}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            {t('dashboard.topCategories.empty')}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const chartData = categories.map((category) => ({
    name: category.categoryName,
    value: category.amount,
  }));

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          {t('dashboard.topCategories.title')}
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
                  stroke={palette.background.paper}
                  strokeWidth={2}
                  onClick={
                    onSelectCategory
                      ? (_, index) => onSelectCategory(categories[index].categoryId)
                      : undefined
                  }
                >
                  {chartData.map((_, index) => (
                    <Cell key={index} fill={seriesColors[index % seriesColors.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </Box>
          <Stack spacing={1} sx={{ minWidth: { md: 220 }, width: { xs: '100%', md: 'auto' } }}>
            {categories.map((category, index) => (
              <Stack
                key={category.categoryId}
                direction="row"
                spacing={1}
                onClick={onSelectCategory ? () => onSelectCategory(category.categoryId) : undefined}
                sx={{
                  alignItems: 'center',
                  ...(onSelectCategory ? CLICKABLE_ROW_SX : {}),
                }}
              >
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: seriesColors[index % seriesColors.length],
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                  {category.categoryName}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatter.number({ value: category.amount })}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  ({formatter.percentagePoints(category.percentage)})
                </Typography>
                <CategoryTrendIcon trend={category.change.trend} />
              </Stack>
            ))}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
