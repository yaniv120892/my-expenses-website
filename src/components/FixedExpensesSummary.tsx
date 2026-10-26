'use client';

import { Box, Card, CardContent, Typography } from '@mui/material';
import { ScheduledTransaction } from '@/types';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import type { T } from '@/i18n/useT.types';
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
  const t = useT();
  const formatter = useAppFormat();
  const forecast = forecastFixedExpenses(scheduledTransactions, today);
  if (forecast.expenseCount === 0) {
    return null;
  }

  const monthName = formatter.date(today, { month: 'long' });

  return (
    <Box
      component="section"
      aria-label={t('dashboard.fixedExpenses.label')}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        gap: 2,
        mb: { xs: 2, md: 3 },
      }}
    >
      <SummaryCard
        title={t('dashboard.fixedExpenses.leftInMonth', { month: monthName })}
        value={forecast.remainingThisMonth}
        caption={describeRemainingCharges({
          count: forecast.remainingCount,
          t,
        })}
      />
      <SummaryCard
        title={t('dashboard.fixedExpenses.perMonth')}
        value={forecast.monthlyTotal}
        caption={t('dashboard.fixedExpenses.perMonthCaption')}
      />
    </Box>
  );
}

function describeRemainingCharges({
  count,
  t,
}: {
  count: number;
  t: T;
}): string {
  return count === 1
    ? t('dashboard.fixedExpenses.remaining.one')
    : t('dashboard.fixedExpenses.remaining.other', { count });
}

function SummaryCard({ title, value, caption }: SummaryCardProps) {
  const formatter = useAppFormat();
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
          {formatter.currency(value)}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          {caption}
        </Typography>
      </CardContent>
    </Card>
  );
}
