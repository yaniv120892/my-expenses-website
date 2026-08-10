'use client';

import { Box, Paper, Typography, useTheme } from '@mui/material';
import { StatsView, ViewStat, ViewTone } from '@/shared/types/chat';
import { formatCurrency, formatNumber } from '@/utils/format';
import BlockShell from '@/components/chat/blocks/BlockShell';

function formatStatValue(stat: ViewStat): string {
  switch (stat.format) {
    case 'currency':
      return formatCurrency(stat.value);
    case 'percent':
      return `${stat.value}%`;
    case 'number':
    default:
      return formatNumber(stat.value);
  }
}

export default function StatsBlock({ view }: { view: StatsView }) {
  const theme = useTheme();

  const toneColor = (tone: ViewTone | undefined): string => {
    switch (tone) {
      case 'income':
        return theme.palette.charts.income;
      case 'expense':
        return theme.palette.charts.expense;
      default:
        return theme.palette.text.primary;
    }
  };

  return (
    <BlockShell title={view.title}>
      <Box
        sx={{
          display: 'grid',
          // Tiles wrap instead of shrinking, so three stats stay readable in a
          // narrow chat bubble on a phone.
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 1,
        }}
      >
        {view.stats.map((stat) => (
          <Paper
            key={stat.label}
            variant="outlined"
            sx={{ px: 1.5, py: 1, minWidth: 0 }}
          >
            <Typography variant="caption" color="text.secondary" noWrap>
              {stat.label}
            </Typography>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                color: toneColor(stat.tone),
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {formatStatValue(stat)}
            </Typography>
          </Paper>
        ))}
      </Box>
    </BlockShell>
  );
}
