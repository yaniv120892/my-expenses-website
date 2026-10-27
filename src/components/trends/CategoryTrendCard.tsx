'use client';

import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  IconButton,
  Collapse,
  useTheme,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { CategorySpendingTrend, TransactionType, TrendPeriod } from '@/types/trends';
import { TrendIcon } from './TrendIcon';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { localeDirection, useI18n } from '@yaniv120892/my-ui';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import { ChangeFromPrevious } from './ChangeFromPrevious';
import { shouldReverseNewestFirstAxis, valueAxisOrientation } from './trendFilters';

type CategoryTrendCardProps = {
  trend: CategorySpendingTrend;
  transactionType: TransactionType;
  period: TrendPeriod;
  isExpanded: boolean;
  onExpand: (categoryId: string) => void;
};

export const CategoryTrendCard = ({
  trend,
  transactionType,
  period,
  isExpanded,
  onExpand,
}: CategoryTrendCardProps) => {
  const t = useT();
  const formatter = useAppFormat();
  const direction = localeDirection(useI18n().locale);
  const theme = useTheme();
  const palette = (theme.vars ?? theme).palette;
  const lineColor =
    transactionType === 'EXPENSE' ? palette.charts.negative : palette.charts.positive;
  const isExpense = transactionType === 'EXPENSE';
  const category = trend.categoryName;
  const pointLabel = (date: string) => formatter.trendDate(date, period);

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex' }}>
        <CardActionArea onClick={() => onExpand(trend.categoryId)} sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {isExpense
                ? t('trends.card.categorySpending', { category })
                : t('trends.card.categoryIncome', { category })}
              <TrendIcon trend={trend.trend} />
            </Typography>
            <Box sx={{ display: 'flex', gap: { xs: 3, md: 6 }, flexWrap: 'wrap' }}>
              <Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {isExpense ? t('trends.card.totalSpending') : t('trends.card.totalIncome')}
                </Typography>
                <Typography variant="h5">{formatter.currency(trend.totalAmount)}</Typography>
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
                <ChangeFromPrevious percentageChange={trend.percentageChange} variant="h5" />
              </Box>
            </Box>
          </CardContent>
        </CardActionArea>
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
          <IconButton
            onClick={() => onExpand(trend.categoryId)}
            aria-label={isExpanded ? t('trends.card.collapseChart') : t('trends.card.expandChart')}
          >
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <CardContent sx={{ pt: 0 }}>
          <Box sx={{ height: 200 }}>
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
                  tickFormatter={(value: number) => formatter.number({ value })}
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
                <Line
                  type="monotone"
                  dataKey="amount"
                  name={isExpense ? t('trends.card.spending') : t('trends.card.income')}
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Collapse>
    </Card>
  );
};
