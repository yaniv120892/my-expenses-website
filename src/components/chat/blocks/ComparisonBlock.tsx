'use client';

import {
  Box,
  Divider,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { ComparisonView } from '@/shared/types/chat';
import { formatCurrency, formatNumber } from '@/utils/format';
import BlockShell from '@/components/chat/blocks/BlockShell';

function DifferenceIcon({ difference }: { difference: number }) {
  // Spending semantics: more money out is the bad case, so up is red.
  if (difference > 0) {
    return <TrendingUpIcon fontSize="small" color="error" />;
  }
  if (difference < 0) {
    return <TrendingDownIcon fontSize="small" color="success" />;
  }
  return <TrendingFlatIcon fontSize="small" color="disabled" />;
}

export default function ComparisonBlock({ view }: { view: ComparisonView }) {
  const theme = useTheme();

  const differenceColor =
    view.difference > 0
      ? theme.palette.charts.expense
      : view.difference < 0
        ? theme.palette.charts.income
        : theme.palette.text.secondary;

  return (
    <BlockShell title={view.title}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 1,
        }}
      >
        {view.periods.map((period) => (
          <Paper
            key={period.label}
            variant="outlined"
            sx={{ px: 1.5, py: 1, minWidth: 0 }}
          >
            <Typography variant="caption" color="text.secondary" noWrap>
              {period.label}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {formatCurrency(period.total)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatNumber(period.transactionCount)} transaction
              {period.transactionCount === 1 ? '' : 's'}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Divider sx={{ my: 1 }} />

      <Stack direction="row" alignItems="center" spacing={1}>
        <DifferenceIcon difference={view.difference} />
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          Difference
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, color: differenceColor }}
        >
          {view.difference >= 0 ? '+' : '-'}
          {formatCurrency(Math.abs(view.difference))}
        </Typography>
        {view.percentChange !== null && (
          <Typography variant="caption" sx={{ color: differenceColor }}>
            ({view.percentChange >= 0 ? '+' : ''}
            {view.percentChange}%)
          </Typography>
        )}
      </Stack>
    </BlockShell>
  );
}
