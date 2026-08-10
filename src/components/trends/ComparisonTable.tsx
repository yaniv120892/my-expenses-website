'use client';

import {
  Box,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { CategoryComparison, ComparisonMeasure } from '@/types/trends';
import { formatCurrency } from '@/utils/format';
import {
  formatBucketLabel,
  selectMeasure,
  seriesColor,
} from '@/utils/comparison';
import { useIsMobile } from '@/hooks/useBreakpoints';

interface Props {
  comparison: CategoryComparison;
  measure: ComparisonMeasure;
}

function SeriesDot({ color }: { color: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        bgcolor: color,
        mr: 0.75,
        flexShrink: 0,
      }}
    />
  );
}

export function ComparisonTable({ comparison, measure }: Props) {
  const theme = useTheme();
  const isMobile = useIsMobile();
  const seriesColors = (theme.vars ?? theme).palette.charts.series;

  // The bucket count is unbounded while series are capped at 8, so on mobile a
  // card per period always fits where a horizontally scrolled table would not.
  if (isMobile) {
    return (
      <Stack spacing={1.5}>
        {comparison.buckets.map((bucket, bucketIndex) => (
          <Paper key={bucket.key} variant="outlined" sx={{ p: 1.5 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <Typography variant="subtitle2">
                {formatBucketLabel(bucket, comparison.period)}
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {formatCurrency(selectMeasure(bucket.rowTotal, measure))}
              </Typography>
            </Stack>
            <Stack spacing={0.5}>
              {comparison.series.map((series, index) => (
                <Stack
                  key={series.categoryId}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                >
                  <SeriesDot color={seriesColor(index, seriesColors)} />
                  <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                    {series.categoryName}
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(
                      selectMeasure(
                        comparison.buckets[bucketIndex].cells[index],
                        measure,
                      ),
                    )}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        ))}
      </Stack>
    );
  }

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ maxHeight: 480, overflowX: 'auto' }}
    >
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell
              sx={{
                position: 'sticky',
                left: 0,
                zIndex: 3,
                bgcolor: 'background.paper',
              }}
            >
              Period
            </TableCell>
            {comparison.series.map((series, index) => (
              <TableCell key={series.categoryId} align="right">
                <SeriesDot color={seriesColor(index, seriesColors)} />
                {series.categoryName}
              </TableCell>
            ))}
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              Total
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {comparison.buckets.map((bucket) => (
            <TableRow key={bucket.key} hover>
              <TableCell
                sx={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  bgcolor: 'background.paper',
                }}
              >
                {formatBucketLabel(bucket, comparison.period)}
              </TableCell>
              {bucket.cells.map((cell, index) => (
                <TableCell
                  key={comparison.series[index].categoryId}
                  align="right"
                >
                  {formatCurrency(selectMeasure(cell, measure))}
                </TableCell>
              ))}
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {formatCurrency(selectMeasure(bucket.rowTotal, measure))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell
              sx={{
                position: 'sticky',
                left: 0,
                zIndex: 2,
                bgcolor: 'background.paper',
                fontWeight: 700,
              }}
            >
              Total
            </TableCell>
            {comparison.series.map((series) => (
              <TableCell
                key={series.categoryId}
                align="right"
                sx={{ fontWeight: 700 }}
              >
                {formatCurrency(selectMeasure(series.total, measure))}
              </TableCell>
            ))}
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              {formatCurrency(selectMeasure(comparison.grandTotal, measure))}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </TableContainer>
  );
}
