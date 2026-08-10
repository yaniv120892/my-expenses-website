'use client';

import React from 'react';
import {
  Box,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ScheduledTransaction, Category } from '../types';
import { useIsMobile } from '../hooks/useBreakpoints';
import AmountText from './AmountText';
import EmptyState from './EmptyState';
import SwipeableRow from './SwipeableRow';
import {
  formatTransactionDate,
  translateToScheduleSummary,
} from '../utils/format';

function getCategoryName(categoryId: string, categories: Category[]) {
  const found = categories.find((cat) => cat.id === categoryId);
  return found ? found.name : 'N/A';
}

export default function ScheduledTransactionList({
  scheduledTransactions,
  categories,
  onEditAction,
}: {
  scheduledTransactions: ScheduledTransaction[];
  categories: Category[];
  onEditAction: (tx: ScheduledTransaction) => void;
}) {
  const isMobile = useIsMobile();

  if (!scheduledTransactions.length) {
    return <EmptyState message="No scheduled transactions found." />;
  }

  if (isMobile) {
    return (
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack
          divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}
        >
          {scheduledTransactions.map((tx) => (
            <SwipeableRow
              key={tx.id}
              onSwipeRight={() => onEditAction(tx)}
              rightLabel="Edit"
              rightColor="primary.main"
            >
              <Box
                onClick={() => onEditAction(tx)}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 2,
                  px: 2,
                  py: 1.5,
                  cursor: 'pointer',
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {tx.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {getCategoryName(tx.categoryId, categories)}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="div"
                  >
                    {translateToScheduleSummary(
                      tx.scheduleType,
                      tx.interval,
                      tx.dayOfWeek,
                      tx.dayOfMonth,
                    )}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <AmountText type={tx.type} value={tx.value} />
                  <Typography variant="caption" color="text.secondary">
                    {tx.nextRunDate
                      ? formatTransactionDate(tx.nextRunDate)
                      : 'N/A'}
                  </Typography>
                </Box>
              </Box>
            </SwipeableRow>
          ))}
        </Stack>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Description</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Schedule</TableCell>
            <TableCell>Next run</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {scheduledTransactions.map((tx) => (
            <TableRow
              key={tx.id}
              hover
              onClick={() => onEditAction(tx)}
              sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
            >
              <TableCell sx={{ fontWeight: 500 }}>{tx.description}</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>
                {getCategoryName(tx.categoryId, categories)}
              </TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>
                {translateToScheduleSummary(
                  tx.scheduleType,
                  tx.interval,
                  tx.dayOfWeek,
                  tx.dayOfMonth,
                )}
              </TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>
                {tx.nextRunDate ? formatTransactionDate(tx.nextRunDate) : 'N/A'}
              </TableCell>
              <TableCell align="right">
                <AmountText type={tx.type} value={tx.value} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
