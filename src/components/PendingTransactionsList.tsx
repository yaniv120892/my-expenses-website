'use client';

import React, { useState } from 'react';
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { Transaction } from '../types';
import { formatCurrency, formatTransactionDate } from '../utils/format';
import EmptyState from './EmptyState';
import NotificationSnackbar from './NotificationSnackbar';
import SwipeableRow from './SwipeableRow';

type Props = {
  transactions: Transaction[];
  onConfirmAction: (id: string) => void;
  onDeleteAction: (id: string) => void;
};

export default function PendingTransactionsList({
  transactions,
  onConfirmAction,
  onDeleteAction,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>(
    'success',
  );

  function showSnackbar(
    message: string,
    severity: 'success' | 'error' = 'success',
  ) {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }

  function openDialog(transaction: Transaction) {
    setSelectedTransaction(transaction);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setSelectedTransaction(null);
  }

  async function approve(id: string) {
    try {
      await onConfirmAction(id);
      showSnackbar('Transaction approved successfully', 'success');
    } catch {
      showSnackbar('Failed to approve transaction', 'error');
    }
  }

  async function reject(id: string) {
    try {
      await onDeleteAction(id);
      showSnackbar('Transaction rejected successfully', 'success');
    } catch {
      showSnackbar('Failed to reject transaction', 'error');
    }
  }

  async function handleApprove() {
    if (selectedTransaction) {
      await approve(selectedTransaction.id);
      closeDialog();
    }
  }

  async function handleDelete() {
    if (selectedTransaction) {
      await reject(selectedTransaction.id);
      closeDialog();
    }
  }

  if (transactions.length === 0) {
    return <EmptyState message="No pending transactions found." />;
  }

  const amountColor = (type: Transaction['type']) =>
    type === 'INCOME'
      ? theme.palette.charts.income
      : theme.palette.charts.expense;

  return (
    <>
      {isMobile ? (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Stack
            divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}
          >
            {transactions.map((tx) => (
              <SwipeableRow
                key={tx.id}
                onSwipeRight={() => approve(tx.id)}
                onSwipeLeft={() => reject(tx.id)}
                rightLabel="Approve"
                rightColor="success.main"
                leftLabel="Delete"
                leftColor="error.main"
              >
                <Box
                  onClick={() => openDialog(tx)}
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
                      {tx.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {tx.category?.name}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, color: amountColor(tx.type) }}
                    >
                      {formatCurrency(tx.value)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatTransactionDate(tx.date)}
                    </Typography>
                  </Box>
                </Box>
              </SwipeableRow>
            ))}
          </Stack>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Description</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  hover
                  onClick={() => openDialog(tx)}
                  sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
                >
                  <TableCell sx={{ fontWeight: 500 }}>
                    {tx.description}
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    {tx.category?.name}
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    {formatTransactionDate(tx.date)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 600, color: amountColor(tx.type) }}
                  >
                    {formatCurrency(tx.value)}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Approve">
                      <IconButton
                        size="small"
                        color="success"
                        aria-label="Approve transaction"
                        onClick={(e) => {
                          e.stopPropagation();
                          approve(tx.id);
                        }}
                      >
                        <CheckRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        aria-label="Delete transaction"
                        onClick={(e) => {
                          e.stopPropagation();
                          reject(tx.id);
                        }}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
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
            <DialogTitle sx={{ fontWeight: 600 }}>
              {selectedTransaction.description}
            </DialogTitle>
            <DialogContent>
              <Typography color="text.secondary">
                Approve or delete this transaction?
              </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button variant="outlined" onClick={closeDialog}>
                Cancel
              </Button>
              <Button variant="contained" color="error" onClick={handleDelete}>
                Delete
              </Button>
              <Button variant="contained" onClick={handleApprove}>
                Approve
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <NotificationSnackbar
        open={snackbarOpen}
        message={snackbarMessage}
        severity={snackbarSeverity}
        onClose={() => setSnackbarOpen(false)}
      />
    </>
  );
}
