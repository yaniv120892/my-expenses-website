'use client';

import { Box, Card, CardContent, Typography, Button, Chip } from '@mui/material';
import type { RecentTransaction } from '@/types/dashboard';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import AmountText from '@/components/AmountText';

type Props = {
  transactions: RecentTransaction[];
  onViewAll: () => void;
};

export function RecentTransactionsQuickView({ transactions, onViewAll }: Props) {
  const t = useT();
  const formatter = useAppFormat();
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="h4" component="h2">
            {t('dashboard.recent.title')}
          </Typography>
          <Button size="small" onClick={onViewAll}>
            {t('dashboard.recent.viewAll')}
          </Button>
        </Box>

        {!transactions.length && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('dashboard.recent.empty')}
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {transactions.map((transaction) => (
            <Box
              key={transaction.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                py: 0.5,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{
                    fontWeight: 600,
                  }}
                >
                  {transaction.description}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mt: 0.25,
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {formatter.day(new Date(transaction.date))}
                  </Typography>
                  <Chip
                    label={transaction.categoryName}
                    size="small"
                    sx={{ height: 20, fontSize: 11 }}
                  />
                </Box>
              </Box>
              <AmountText
                type={transaction.type}
                value={transaction.value}
                fontWeight={700}
                format="signed"
              />
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
