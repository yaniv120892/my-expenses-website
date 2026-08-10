'use client';

import { Box, Card, CardContent, Typography, Button } from '@mui/material';
import { RecentTransaction } from '@/types/dashboard';
import TransactionRow from '@/components/transactions/TransactionRow';

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
            <TransactionRow
              key={tx.id}
              description={tx.description}
              value={tx.value}
              date={tx.date}
              type={tx.type}
              categoryName={tx.categoryName}
            />
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
