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
import {
  CategorySpendingTrend,
  TransactionType,
  TrendPeriod,
} from '@/types/trends';
import { TrendIcon } from './TrendIcon';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { formatTrendDate } from '@/utils/dateUtils';

interface CategoryTrendCardProps {
  trend: CategorySpendingTrend;
  transactionType: TransactionType;
  period: TrendPeriod;
  isExpanded: boolean;
  onExpand: (categoryId: string) => void;
}

export const CategoryTrendCard = ({
  trend,
  transactionType,
  period,
  isExpanded,
  onExpand,
}: CategoryTrendCardProps) => {
  const theme = useTheme();
  const palette = (theme.vars ?? theme).palette;
  const lineColor =
    transactionType === 'EXPENSE'
      ? palette.charts.expense
      : palette.charts.income;
  const typeLabel = transactionType === 'EXPENSE' ? 'Spending' : 'Income';

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex' }}>
        <CardActionArea
          onClick={() => onExpand(trend.categoryId)}
          sx={{ flex: 1 }}
        >
          <CardContent>
            <Typography
              variant="h5"
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
            >
              {trend.categoryName} {typeLabel}
              <TrendIcon trend={trend.trend} />
            </Typography>
            <Box sx={{ display: 'flex', gap: { xs: 3, md: 6 }, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total {typeLabel}
                </Typography>
                <Typography variant="h5">
                  ₪{trend.totalAmount.toFixed(2)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Change from Previous Period
                </Typography>
                <Typography
                  variant="h5"
                  color={
                    trend.percentageChange > 0 ? 'error.main' : 'success.main'
                  }
                >
                  {trend.percentageChange > 0 ? '+' : ''}
                  {trend.percentageChange.toFixed(1)}%
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </CardActionArea>
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
          <IconButton
            onClick={() => onExpand(trend.categoryId)}
            aria-label={isExpanded ? 'Collapse chart' : 'Expand chart'}
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
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={palette.divider}
                />
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
                  formatter={(value: number) => [
                    `₪${value.toFixed(2)}`,
                    'Amount',
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
                  name={typeLabel}
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
