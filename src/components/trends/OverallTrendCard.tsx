'use client';

import { Box, Typography, Card, CardContent, useTheme } from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { SpendingTrend, TransactionType, TrendPeriod } from '@/types/trends';
import { Category } from '@/types';
import { TrendIcon } from './TrendIcon';
import { useI18n } from '@yaniv120892/my-ui';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import type { T } from '@/i18n/useT.types';
import {
  ALL_CATEGORIES,
  shouldReverseNewestFirstAxis,
  valueAxisOrientation,
} from './trendFilters';
import { ChangeFromPrevious } from './ChangeFromPrevious';

interface OverallTrendCardProps {
  trend: SpendingTrend;
  selectedCategory: string;
  categories: Category[];
  transactionType: TransactionType;
  period: TrendPeriod;
}

export const OverallTrendCard = ({
  trend,
  selectedCategory,
  categories,
  transactionType,
  period,
}: OverallTrendCardProps) => {
  const t = useT();
  const formatter = useAppFormat();
  const { direction } = useI18n();
  const theme = useTheme();
  const palette = (theme.vars ?? theme).palette;
  const lineColor =
    transactionType === 'EXPENSE'
      ? palette.charts.negative
      : palette.charts.positive;

  const categoryName =
    selectedCategory !== ALL_CATEGORIES
      ? categories.find((c) => c.id === selectedCategory)?.name
      : undefined;
  const isExpense = transactionType === 'EXPENSE';
  const labels = overallTrendLabels({ t, isExpense, categoryName });
  const pointLabel = (date: string) => formatter.trendDate(date, period);

  if (!trend.points.length) {
    return (
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              textAlign: 'center',
            }}
          >
            {t('trends.card.noTransactions')}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography
          variant="h4"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          {labels.title}
          <TrendIcon trend={trend.trend} />
        </Typography>
        <Box
          sx={{
            display: 'flex',
            gap: { xs: 3, md: 6 },
            mt: 2,
            mb: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {isExpense
                ? t('trends.card.totalSpending')
                : t('trends.card.totalIncome')}
            </Typography>
            <Typography variant="h4">
              {formatter.currency(trend.totalAmount)}
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t('trends.card.change')}
            </Typography>
            <ChangeFromPrevious
              percentageChange={trend.percentageChange}
              variant="h4"
            />
          </Box>
        </Box>
        <Box sx={{ height: { xs: 240, md: 300 } }}>
          <ResponsiveContainer>
            <LineChart data={trend.points}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.divider} />
              <XAxis
                dataKey="date"
                tickFormatter={pointLabel}
                stroke={palette.text.secondary}
                tick={{ fill: palette.text.secondary, fontSize: 12 }}
                reversed={shouldReverseNewestFirstAxis(direction)}
              />
              <YAxis
                stroke={palette.text.secondary}
                tick={{ fill: palette.text.secondary, fontSize: 12 }}
                tickFormatter={(value: number) => formatter.number(value)}
                width={48}
                orientation={valueAxisOrientation(direction)}
              />
              <Tooltip
                labelFormatter={(date) => pointLabel(String(date))}
                formatter={(value) => [
                  formatter.currency(Number(value)),
                  t('trends.card.amount'),
                ]}
                contentStyle={{
                  backgroundColor: palette.background.paper,
                  border: `1px solid ${palette.divider}`,
                  borderRadius: 10,
                  color: palette.text.primary,
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="amount"
                name={labels.series}
                stroke={lineColor}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};

function overallTrendLabels({
  t,
  isExpense,
  categoryName,
}: {
  t: T;
  isExpense: boolean;
  categoryName?: string;
}): { title: string; series: string } {
  if (categoryName) {
    return isExpense
      ? {
          title: t('trends.card.categorySpendingTitle', {
            category: categoryName,
          }),
          series: t('trends.card.categorySpending', { category: categoryName }),
        }
      : {
          title: t('trends.card.categoryIncomeTitle', {
            category: categoryName,
          }),
          series: t('trends.card.categoryIncome', { category: categoryName }),
        };
  }
  return isExpense
    ? {
        title: t('trends.card.overallSpendingTitle'),
        series: t('trends.card.spending'),
      }
    : {
        title: t('trends.card.overallIncomeTitle'),
        series: t('trends.card.income'),
      };
}
