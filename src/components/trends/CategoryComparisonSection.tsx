'use client';

import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { CategoryComparison, ComparisonMeasure } from '@/types/trends';
import {
  MEASURE_LABELS,
  comparisonFileName,
  comparisonToCsv,
} from '@/utils/comparison';
import { downloadCsv } from '@/utils/download';
import { TrendCardSkeleton } from '@/components/trends/TrendSkeleton';
import {
  ComparisonChart,
  ComparisonChartMode,
} from '@/components/trends/ComparisonChart';
import { ComparisonTable } from '@/components/trends/ComparisonTable';

interface Props {
  comparison?: CategoryComparison;
  isLoading: boolean;
  isError: boolean;
  selectedCount: number;
  measure: ComparisonMeasure;
  onMeasureChange: (measure: ComparisonMeasure) => void;
  onOpenFilters: () => void;
}

// Above this many periods a grouped bar chart stops being readable.
const CROWDED_BUCKET_COUNT = 40;

export function CategoryComparisonSection({
  comparison,
  isLoading,
  isError,
  selectedCount,
  measure,
  onMeasureChange,
  onOpenFilters,
}: Props) {
  const [chartMode, setChartMode] = useState<ComparisonChartMode>('grouped');

  if (selectedCount === 0) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h5" sx={{ mb: 1 }}>
            Compare categories
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pick up to 8 categories to see them side by side as a table and a
            chart, then export the result.
          </Typography>
          <Button variant="contained" onClick={onOpenFilters}>
            Choose categories
          </Button>
        </CardContent>
      </Card>
    );
  }

  // A rejected range (or any other 400) would otherwise leave the skeleton up
  // forever, since there is nothing left to load.
  if (isError) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={onOpenFilters}>
                Change filters
              </Button>
            }
          >
            Could not load the comparison. Check the dates and categories you
            picked, then try again.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !comparison) {
    return <TrendCardSkeleton />;
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
          sx={{ mb: 2 }}
        >
          <Typography variant="h5">Compare categories</Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <ToggleButtonGroup
              value={measure}
              exclusive
              size="small"
              onChange={(_, value) => {
                if (value) onMeasureChange(value as ComparisonMeasure);
              }}
              aria-label="Measure"
            >
              <ToggleButton value="net">{MEASURE_LABELS.net}</ToggleButton>
              <ToggleButton value="expense">
                {MEASURE_LABELS.expense}
              </ToggleButton>
              <ToggleButton value="income">
                {MEASURE_LABELS.income}
              </ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              value={chartMode}
              exclusive
              size="small"
              onChange={(_, value) => {
                if (value) setChartMode(value as ComparisonChartMode);
              }}
              aria-label="Chart type"
            >
              <ToggleButton value="grouped">Grouped</ToggleButton>
              <ToggleButton value="stacked">Stacked</ToggleButton>
              <ToggleButton value="lines">Lines</ToggleButton>
            </ToggleButtonGroup>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadRoundedIcon />}
              onClick={() =>
                downloadCsv(
                  comparisonFileName(comparison),
                  comparisonToCsv(comparison, measure),
                )
              }
            >
              Export CSV
            </Button>
          </Stack>
        </Stack>

        {comparison.hasOverlappingSeries && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            One selected category contains another, so their columns count some
            transactions twice. The Total column still counts each transaction
            once.
          </Alert>
        )}

        {comparison.buckets.length > CROWDED_BUCKET_COUNT && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {comparison.buckets.length} periods is a lot for one chart. A wider
            period or a shorter date range will read more clearly.
          </Alert>
        )}

        <ComparisonChart
          comparison={comparison}
          measure={measure}
          mode={chartMode}
        />

        <Stack sx={{ mt: 3 }}>
          <ComparisonTable comparison={comparison} measure={measure} />
        </Stack>
      </CardContent>
    </Card>
  );
}
