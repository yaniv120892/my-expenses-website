'use client';

import React, { Fragment, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import type { Transaction } from '../types';
import { useIsMobile } from '../hooks/useBreakpoints';
import AmountText from './AmountText';
import EmptyState from './EmptyState';
import SwipeableRow from './SwipeableRow';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';

type Props = {
  transactions: Transaction[];
  // Outcome toasts belong to the caller that owns the mutation.
  onConfirmAction: (id: string) => Promise<void>;
  onDeleteAction: (id: string) => Promise<void>;
  /** A viewer sees the rows with no way to approve or delete them. */
  readOnly?: boolean;
};

export default function PendingTransactionsList({
  transactions,
  onConfirmAction,
  onDeleteAction,
  readOnly = false,
}: Props) {
  const t = useT();
  const formatter = useAppFormat();
  const isMobile = useIsMobile();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  function openDialog(transaction: Transaction) {
    setSelectedTransaction(transaction);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setSelectedTransaction(null);
  }

  // finally: even a handler that breaks the never-reject contract must not
  // leave the dialog stuck open with no feedback.
  async function handleApprove() {
    if (selectedTransaction) {
      try {
        await onConfirmAction(selectedTransaction.id);
      } finally {
        closeDialog();
      }
    }
  }

  async function handleDelete() {
    if (selectedTransaction) {
      try {
        await onDeleteAction(selectedTransaction.id);
      } finally {
        closeDialog();
      }
    }
  }

  if (transactions.length === 0) {
    return <EmptyState message={t('pending.empty')} />;
  }

  return (
    <>
      {isMobile ? (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
            {transactions.map((tx) => {
              const row = (
                <Box
                  onClick={readOnly ? undefined : () => openDialog(tx)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    px: 2,
                    py: 1.5,
                    cursor: readOnly ? 'default' : 'pointer',
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
                      {tx.category?.name}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <AmountText type={tx.type} value={tx.value} original={tx} />
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      {formatter.day(tx.date)}
                    </Typography>
                  </Box>
                </Box>
              );
              return readOnly ? (
                <Fragment key={tx.id}>{row}</Fragment>
              ) : (
                <SwipeableRow
                  key={tx.id}
                  onSwipeRight={() => void onConfirmAction(tx.id)}
                  onSwipeLeft={() => void onDeleteAction(tx.id)}
                  rightLabel={t('pending.approve')}
                  rightColor="success.main"
                  leftLabel={t('pending.delete')}
                  leftColor="error.main"
                >
                  {row}
                </SwipeableRow>
              );
            })}
          </Stack>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('pending.column.description')}</TableCell>
                <TableCell>{t('pending.column.category')}</TableCell>
                <TableCell>{t('pending.column.date')}</TableCell>
                <TableCell align="right">{t('pending.column.amount')}</TableCell>
                {!readOnly && <TableCell align="right">{t('pending.column.actions')}</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  hover={!readOnly}
                  onClick={readOnly ? undefined : () => openDialog(tx)}
                  sx={{
                    cursor: readOnly ? 'default' : 'pointer',
                    '&:last-child td': { border: 0 },
                  }}
                >
                  <TableCell sx={{ fontWeight: 500 }}>{tx.description}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{tx.category?.name}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{formatter.day(tx.date)}</TableCell>
                  <TableCell align="right">
                    <AmountText type={tx.type} value={tx.value} original={tx} />
                  </TableCell>
                  {!readOnly && (
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title={t('pending.approve')}>
                        <IconButton
                          size="small"
                          color="success"
                          aria-label={t('pending.approveAria')}
                          onClick={(e) => {
                            e.stopPropagation();
                            void onConfirmAction(tx.id);
                          }}
                        >
                          <CheckRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('pending.delete')}>
                        <IconButton
                          size="small"
                          color="error"
                          aria-label={t('pending.deleteAria')}
                          onClick={(e) => {
                            e.stopPropagation();
                            void onDeleteAction(tx.id);
                          }}
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={isDialogOpen && !!selectedTransaction}
        onClose={closeDialog}
        maxWidth="xs"
        fullWidth
      >
        {selectedTransaction && (
          <>
            <DialogTitle sx={{ fontWeight: 600 }}>{selectedTransaction.description}</DialogTitle>
            <DialogContent>
              <Typography
                sx={{
                  color: 'text.secondary',
                }}
              >
                {t('pending.dialog.question')}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button variant="outlined" onClick={closeDialog}>
                {t('common.cancel')}
              </Button>
              <Button variant="contained" color="error" onClick={handleDelete}>
                {t('pending.delete')}
              </Button>
              <Button variant="contained" onClick={handleApprove}>
                {t('pending.approve')}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
