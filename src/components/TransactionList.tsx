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
import { Transaction } from '../types';
import { formatTransactionDate } from '../utils/format';
import { useIsMobile } from '../hooks/useBreakpoints';
import AmountText from './AmountText';
import EmptyState from './EmptyState';
import SwipeableRow from './SwipeableRow';

function MobileRow({
  transaction,
  onEdit,
}: {
  transaction: Transaction;
  onEdit: (tx: Transaction) => void;
}) {
  return (
    <Box
      onClick={() => onEdit(transaction)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        px: 2,
        py: 1.5,
        cursor: 'pointer',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {transaction.description}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {transaction.category?.name}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <AmountText type={transaction.type} value={transaction.value} />
        <Typography variant="caption" color="text.secondary">
          {formatTransactionDate(transaction.date)}
        </Typography>
      </Box>
    </Box>
  );
}

export default function TransactionList({
  transactions,
  onEditAction,
}: {
  transactions: Transaction[];
  onEditAction: (tx: Transaction) => void;
  onDeleteAction: (id: string) => void;
}) {
  const isMobile = useIsMobile();

  if (!transactions.length) {
    return <EmptyState message="No transactions found." />;
  }

  if (isMobile) {
    return (
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack
          divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}
        >
          {transactions.map((tx) => (
            <SwipeableRow
              key={tx.id}
              onSwipeRight={() => onEditAction(tx)}
              rightLabel="Edit"
              rightColor="primary.main"
            >
              <MobileRow transaction={tx} onEdit={onEditAction} />
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
            <TableCell>Date</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow
              key={tx.id}
              hover
              onClick={() => onEditAction(tx)}
              sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
            >
              <TableCell sx={{ fontWeight: 500 }}>{tx.description}</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>
                {tx.category?.name}
              </TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>
                {formatTransactionDate(tx.date)}
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
