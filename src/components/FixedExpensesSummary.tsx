'use client';

import { Box, Card, CardContent, Typography } from '@mui/material';
import { ScheduledTransaction } from '@/types';
import { formatCurrency } from '@/utils/format';
import { forecastFixedExpenses } from '@/utils/scheduledForecast';

type FixedExpensesSummaryProps = {
  scheduledTransactions: ScheduledTransaction[];
  today: Date;
};

type SummaryCardProps = {
  title: string;
  value: number;
  caption: string;
};

export default function FixedExpensesSummary({
  scheduledTransactions,
  today,
}: FixedExpensesSummaryProps) {
  const forecast = forecastFixedExpenses(scheduledTransactions, today);
  if (forecast.expenseCount === 0) {
    return null;
  }

  const monthName = today.toLocaleString('en-US', { month: 'long' });

  return (
    <Box
      component="section"
      aria-label="Fixed expenses"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        gap: 2,
        mb: { xs: 2, md: 3 },
      }}
    >
      <SummaryCard
        title={`Fixed expenses left in ${monthName}`}
        value={forecast.remainingThisMonth}
        caption={
          forecast.remainingCount === 1
            ? '1 scheduled charge to go'
            : `${forecast.remainingCount} scheduled charges to go`
        }
      />
      <SummaryCard
        title="Fixed expenses per month"
        value={forecast.monthlyTotal}
        caption="Average across all scheduled expenses"
      />
    </Box>
  );
}

function SummaryCard({ title, value, caption }: SummaryCardProps) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography
          variant="body2"
          gutterBottom
          sx={{ color: 'text.secondary' }}
        >
          {title}
        </Typography>
        <Typography variant="h3" component="p">
          {formatCurrency(value)}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          {caption}
        </Typography>
      </CardContent>
    </Card>
  );
}
