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
import type { CategoryComparison, ComparisonMeasure } from '@/types/trends';
import { COMPARISON_MEASURES } from '@/types/trends';
import { comparisonFileName, comparisonToCsv } from '@/utils/comparison';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import { downloadCsv } from '@/utils/download';
import { isOneOf } from '@/utils/oneOf';
import { TrendCardSkeleton } from '@/components/trends/TrendSkeleton';
import type { ComparisonChartMode } from '@/components/trends/ComparisonChart';
import { COMPARISON_CHART_MODES, ComparisonChart } from '@/components/trends/ComparisonChart';
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

const CROWDED_BUCKET_COUNT = 40;

const MEASURE_TOGGLE_ORDER: readonly ComparisonMeasure[] = ['net', 'expense', 'income'];

export function CategoryComparisonSection({
  comparison,
  isLoading,
  isError,
  selectedCount,
  measure,
  onMeasureChange,
  onOpenFilters,
}: Props) {
  const t = useT();
  const formatter = useAppFormat();
  const [chartMode, setChartMode] = useState<ComparisonChartMode>('grouped');

  if (selectedCount === 0) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h5" sx={{ mb: 1 }}>
            {t('trends.compare.title')}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mb: 2,
            }}
          >
            {t('trends.compare.intro')}
          </Typography>
          <Button variant="contained" onClick={onOpenFilters}>
            {t('trends.compare.chooseCategories')}
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
                {t('trends.compare.changeFilters')}
              </Button>
            }
          >
            {t('trends.compare.loadError')}
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
          sx={{
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', md: 'center' },
            mb: 2,
          }}
        >
          <Typography variant="h5">{t('trends.compare.title')}</Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{
              alignItems: { xs: 'stretch', sm: 'center' },
            }}
          >
            <ToggleButtonGroup
              value={measure}
              exclusive
              size="small"
              onChange={(_, value) => {
                if (isOneOf(COMPARISON_MEASURES, value)) {
                  onMeasureChange(value);
                }
              }}
              aria-label={t('trends.compare.measureLabel')}
            >
              {MEASURE_TOGGLE_ORDER.map((option) => (
                <ToggleButton key={option} value={option}>
                  {t(`trends.measure.${option}`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <ToggleButtonGroup
              value={chartMode}
              exclusive
              size="small"
              onChange={(_, value) => {
                if (isOneOf(COMPARISON_CHART_MODES, value)) {
                  setChartMode(value);
                }
              }}
              aria-label={t('trends.compare.chartTypeLabel')}
            >
              {COMPARISON_CHART_MODES.map((mode) => (
                <ToggleButton key={mode} value={mode}>
                  {t(`trends.compare.chart.${mode}`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadRoundedIcon />}
              onClick={() =>
                downloadCsv(
                  comparisonFileName(comparison),
                  comparisonToCsv({ comparison, measure, t, formatter }),
                )
              }
            >
              {t('trends.compare.exportCsv')}
            </Button>
          </Stack>
        </Stack>

        {comparison.hasOverlappingSeries && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('trends.compare.overlapWarning')}
          </Alert>
        )}

        {comparison.buckets.length > CROWDED_BUCKET_COUNT && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('trends.compare.crowded', {
              count: comparison.buckets.length,
            })}
          </Alert>
        )}

        <ComparisonChart comparison={comparison} measure={measure} mode={chartMode} />

        <Stack sx={{ mt: 3 }}>
          <ComparisonTable comparison={comparison} measure={measure} />
        </Stack>
      </CardContent>
    </Card>
  );
}
