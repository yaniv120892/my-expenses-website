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
import type { TooltipContentProps } from 'recharts';
import { CategoryBreakdownItem } from '@/types';
import { formatCurrency } from '@/utils/format';
import { CLICKABLE_SLICE_SX } from '@/components/chartStyles';

type Props = {
  title: string;
  items: CategoryBreakdownItem[];
  loading?: boolean;
  error?: boolean;
  selectedCategoryId?: string;
  onSelectCategory: (categoryId: string) => void;
};

const UNSELECTED_SLICE_OPACITY = 0.3;
const UNSELECTED_ROW_OPACITY = 0.6;

const CLICKABLE_ROW_SX = {
  cursor: 'pointer',
  borderRadius: 1,
  px: 0.5,
  mx: -0.5,
  '&:hover': { bgcolor: 'action.hover' },
};

type ChartTooltipProps = Pick<
  TooltipContentProps<number, string>,
  'active' | 'payload'
> & { items: CategoryBreakdownItem[] };

function ChartTooltip({ active, payload, items }: ChartTooltipProps) {
  const hovered = active ? payload?.[0]?.name : undefined;
  const item = items.find((candidate) => candidate.categoryName === hovered);
  if (!item) {
    return null;
  }
  return (
    <Paper variant="outlined" sx={{ px: 1, py: 0.5, whiteSpace: 'nowrap' }}>
      <Typography variant="caption">
        <Box component="span" sx={{ fontWeight: 600 }}>
          {item.categoryName}:
        </Box>{' '}
        {formatCurrency(item.amount)} ({item.percentage.toFixed(1)}%)
      </Typography>
    </Paper>
  );
}

export default function CategoryBreakdownPieChart({
  title,
  items,
  loading,
  error,
  selectedCategoryId,
  onSelectCategory,
}: Props) {
  const theme = useTheme();
  const palette = (theme.vars ?? theme).palette;
  const seriesColors = palette.charts.series;
  const hasSelectedSlice = items.some(
    (item) => item.categoryId === selectedCategoryId,
  );
  const isDimmed = (categoryId: string) =>
    hasSelectedSlice && selectedCategoryId !== categoryId;

  const renderBody = () => {
    if (loading) {
      return (
        <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
          <Skeleton variant="circular" width={180} height={180} />
          <Stack spacing={1} sx={{ minWidth: 160 }}>
            <Skeleton width={140} />
            <Skeleton width={140} />
            <Skeleton width={140} />
          </Stack>
        </Stack>
      );
    }
    if (error) {
      return (
        <Typography variant="body2" sx={{ color: 'error.main' }}>
          Failed to load category breakdown
        </Typography>
      );
    }
    if (!items.length) {
      return (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No transactions in this period
        </Typography>
      );
    }
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Box
          sx={{
            width: 180,
            height: 180,
            flexShrink: 0,
            ...CLICKABLE_SLICE_SX,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={items}
                dataKey="amount"
                nameKey="categoryName"
                cx="50%"
                cy="50%"
                outerRadius={88}
                innerRadius={50}
                stroke={palette.background.paper}
                strokeWidth={2}
                startAngle={90}
                endAngle={-270}
                onClick={(_, index) =>
                  onSelectCategory(items[index].categoryId)
                }
              >
                {items.map((item, idx) => (
                  <Cell
                    key={item.categoryId}
                    fill={seriesColors[idx % seriesColors.length]}
                    fillOpacity={
                      isDimmed(item.categoryId) ? UNSELECTED_SLICE_OPACITY : 1
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                content={(props) => <ChartTooltip {...props} items={items} />}
              />
            </PieChart>
          </ResponsiveContainer>
        </Box>
        <Stack
          spacing={0.75}
          sx={{ flex: 1, minWidth: 0, width: '100%', maxWidth: 420 }}
        >
          {items.map((item, idx) => (
            <Stack
              key={item.categoryId}
              direction="row"
              spacing={1}
              role="button"
              aria-pressed={selectedCategoryId === item.categoryId}
              onClick={() => onSelectCategory(item.categoryId)}
              sx={{
                alignItems: 'center',
                opacity: isDimmed(item.categoryId) ? UNSELECTED_ROW_OPACITY : 1,
                ...CLICKABLE_ROW_SX,
              }}
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
                {item.categoryName}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {item.percentage.toFixed(1)}%
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', minWidth: 72, textAlign: 'end' }}
              >
                {formatCurrency(item.amount)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    );
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {renderBody()}
    </Paper>
  );
}
