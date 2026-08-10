'use client';

import { Box, Divider, Stack, Typography } from '@mui/material';
import { TransactionListView } from '@/shared/types/chat';
import { formatCurrency, formatNumber } from '@/utils/format';
import TransactionRow from '@/components/transactions/TransactionRow';
import BlockShell from '@/components/chat/blocks/BlockShell';

export default function TransactionListBlock({
  view,
}: {
  view: TransactionListView;
}) {
  const hiddenCount = view.totalCount - view.items.length;

  return (
    <BlockShell title={view.title}>
      {/* Capped so a thousand-row answer scrolls inside the bubble rather than
          pushing the conversation off screen. */}
      <Stack sx={{ maxHeight: 320, overflowY: 'auto' }}>
        {view.items.map((item) => (
          <TransactionRow
            key={item.id}
            description={item.description}
            value={item.value}
            date={item.date}
            type={item.type}
            categoryName={item.categoryName}
          />
        ))}
      </Stack>

      <Divider sx={{ my: 1 }} />

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {hiddenCount > 0
            ? `Showing ${formatNumber(view.items.length)} of ${formatNumber(view.totalCount)}`
            : `${formatNumber(view.totalCount)} transaction${view.totalCount === 1 ? '' : 's'}`}
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {formatCurrency(view.totalValue)}
        </Typography>
      </Box>
    </BlockShell>
  );
}
