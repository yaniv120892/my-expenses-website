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
import type { Transaction } from '../types';
import { useIsMobile } from '../hooks/useBreakpoints';
import AmountText from './AmountText';
import EmptyState from './EmptyState';
import SwipeableRow from './SwipeableRow';
import AttributionLine from './transactions/AttributionLine';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';

function MobileRow({
  transaction,
  onEdit,
}: {
  transaction: Transaction;
  onEdit?: (tx: Transaction) => void;
}) {
  const formatter = useAppFormat();
  return (
    <Box
      onClick={onEdit && (() => onEdit(transaction))}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        px: 2,
        py: 1.5,
        cursor: onEdit ? 'pointer' : 'default',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {transaction.description}
        </Typography>
        <Typography
          variant="caption"
          noWrap
          sx={{
            color: 'text.secondary',
          }}
        >
          {transaction.category?.name}
        </Typography>
        <AttributionLine addedBy={transaction.addedBy} editedBy={transaction.editedBy} />
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <AmountText type={transaction.type} value={transaction.value} original={transaction} />
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
          }}
        >
          {formatter.day(new Date(transaction.date))}
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
  /** Absent for a viewer, who can open no row for editing. */
  onEditAction?: (tx: Transaction) => void;
}) {
  const isMobile = useIsMobile();
  const t = useT();
  const formatter = useAppFormat();

  if (!transactions.length) {
    return <EmptyState message={t('transactions.list.empty')} />;
  }

  if (isMobile) {
    return (
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
          {transactions.map((tx) =>
            onEditAction ? (
              <SwipeableRow
                key={tx.id}
                onSwipeRight={() => onEditAction(tx)}
                rightLabel={t('transactions.list.edit')}
                rightColor="primary.main"
              >
                <MobileRow transaction={tx} onEdit={onEditAction} />
              </SwipeableRow>
            ) : (
              <MobileRow key={tx.id} transaction={tx} />
            ),
          )}
        </Stack>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('common.description')}</TableCell>
            <TableCell>{t('common.category')}</TableCell>
            <TableCell>{t('common.date')}</TableCell>
            <TableCell align="right">{t('common.amount')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow
              key={tx.id}
              hover={!!onEditAction}
              onClick={onEditAction && (() => onEditAction(tx))}
              sx={{
                cursor: onEditAction ? 'pointer' : 'default',
                '&:last-child td': { border: 0 },
              }}
            >
              <TableCell sx={{ fontWeight: 500 }}>
                <Box component="span" sx={{ display: 'block' }}>
                  {tx.description}
                </Box>
                <AttributionLine addedBy={tx.addedBy} editedBy={tx.editedBy} />
              </TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>{tx.category?.name}</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>
                {formatter.day(new Date(tx.date))}
              </TableCell>
              <TableCell align="right">
                <AmountText type={tx.type} value={tx.value} original={tx} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
