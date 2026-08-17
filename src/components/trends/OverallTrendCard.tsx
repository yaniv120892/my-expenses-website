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
import { formatTrendDate } from '@/utils/dateUtils';
import { formatCurrency } from '@/utils/format';

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
  const theme = useTheme();
  const palette = (theme.vars ?? theme).palette;
  const lineColor =
    transactionType === 'EXPENSE'
      ? palette.charts.expense
      : palette.charts.income;

  const categoryName =
    selectedCategory !== 'All Categories'
      ? categories.find((c) => c.id === selectedCategory)?.name
      : undefined;
  const typeLabel = transactionType === 'EXPENSE' ? 'Spending' : 'Income';

  if (!trend.points.length) {
    return (
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            No transactions found for selected period and category
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
          {categoryName ? `${categoryName} ` : 'Overall '}
          {typeLabel} Trend
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
            <Typography variant="body2" color="text.secondary">
              Total {typeLabel}
            </Typography>
            <Typography variant="h4">
              {formatCurrency(trend.totalAmount)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Change from Previous Period
            </Typography>
            <Typography
              variant="h4"
              color={trend.percentageChange > 0 ? 'error.main' : 'success.main'}
            >
              {trend.percentageChange > 0 ? '+' : ''}
              {trend.percentageChange.toFixed(1)}%
            </Typography>
          </Box>
        </Box>
        <Box sx={{ height: { xs: 240, md: 300 } }}>
          <ResponsiveContainer>
            <LineChart data={trend.points}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.divider} />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => formatTrendDate(date, period)}
                stroke={palette.text.secondary}
                tick={{ fill: palette.text.secondary, fontSize: 12 }}
                reversed={true}
              />
              <YAxis
                stroke={palette.text.secondary}
                tick={{ fill: palette.text.secondary, fontSize: 12 }}
                width={48}
              />
              <Tooltip
                labelFormatter={(date) => formatTrendDate(date, period)}
                formatter={(value: number) => [formatCurrency(value), 'Amount']}
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
                name={`${categoryName ? `${categoryName} ` : ''}${typeLabel}`}
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
