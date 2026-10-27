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
import { scheduleSummary, useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';

export default function ScheduledTransactionList({
  scheduledTransactions,
  categories,
  onEditAction,
}: {
  scheduledTransactions: ScheduledTransaction[];
  categories: Category[];
  onEditAction: (tx: ScheduledTransaction) => void;
}) {
  const t = useT();
  const formatter = useAppFormat();
  const isMobile = useIsMobile();

  function categoryName(categoryId: string) {
    const found = categories.find((category) => category.id === categoryId);
    return found ? found.name : t('scheduled.notAvailable');
  }

  function summary(schedule: ScheduledTransaction) {
    return scheduleSummary({ schedule, t, formatter });
  }

  function nextRun(schedule: ScheduledTransaction) {
    return schedule.nextRunDate ? formatter.day(schedule.nextRunDate) : t('scheduled.notAvailable');
  }

  if (!scheduledTransactions.length) {
    return <EmptyState message={t('scheduled.empty')} />;
  }

  if (isMobile) {
    return (
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
          {scheduledTransactions.map((tx) => (
            <SwipeableRow
              key={tx.id}
              onSwipeRight={() => onEditAction(tx)}
              rightLabel={t('scheduled.edit')}
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
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {categoryName(tx.categoryId)}
                  </Typography>
                  <Typography
                    variant="caption"
                    component="div"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {summary(tx)}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <AmountText type={tx.type} value={tx.value} />
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {nextRun(tx)}
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
            <TableCell>{t('scheduled.column.description')}</TableCell>
            <TableCell>{t('scheduled.column.category')}</TableCell>
            <TableCell>{t('scheduled.column.schedule')}</TableCell>
            <TableCell>{t('scheduled.column.nextRun')}</TableCell>
            <TableCell align="right">{t('scheduled.column.amount')}</TableCell>
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
              <TableCell sx={{ color: 'text.secondary' }}>{categoryName(tx.categoryId)}</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>{summary(tx)}</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>{nextRun(tx)}</TableCell>
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
