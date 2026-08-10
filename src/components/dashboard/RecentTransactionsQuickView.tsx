'use client';

import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
} from '@mui/material';
import { RecentTransaction } from '@/types/dashboard';
import { formatTransactionDate } from '@/utils/format';
import AmountText from '@/components/AmountText';

interface Props {
  transactions: RecentTransaction[];
  onViewAll: () => void;
}

export function RecentTransactionsQuickView({
  transactions,
  onViewAll,
}: Props) {
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
            Recent Transactions
          </Typography>
          <Button size="small" onClick={onViewAll}>
            View All
          </Button>
        </Box>

        {!transactions.length && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No transactions yet
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {transactions.map((tx) => (
            <Box
              key={tx.id}
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
                <Typography variant="body2" fontWeight={600} noWrap>
                  {tx.description}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mt: 0.25,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
                    {formatTransactionDate(tx.date)}
                  </Typography>
                  <Chip
                    label={tx.categoryName}
                    size="small"
                    sx={{ height: 20, fontSize: 11 }}
                  />
                </Box>
              </Box>
              <AmountText
                type={tx.type}
                value={tx.value}
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
