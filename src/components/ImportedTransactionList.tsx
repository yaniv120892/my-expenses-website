'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Typography,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import MergeIcon from '@mui/icons-material/MergeType';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import {
  useImportedTransactionsQuery,
  useApproveImportedTransactionMutation,
  useMergeImportedTransactionMutation,
  useDeleteImportedTransactionMutation,
  useIgnoreImportedTransactionMutation,
  useAutoApproveRulesQuery,
} from '../hooks/useImports';
import { formatDate } from '../utils/dateUtils';
import {
  ImportedTransactionStatus,
  ImportedTransaction,
  TransactionApprovalStatus,
} from '../types/import';
import TransactionForm from './TransactionForm';
import BatchActionToolbar from './BatchActionToolbar';
import { CreateTransactionInput } from '../types';

interface ImportedTransactionListProps {
  importId: string;
}

const formatAmount = (value: number) =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
  }).format(value);

function getStatusColor(status: ImportedTransactionStatus) {
  switch (status) {
    case ImportedTransactionStatus.APPROVED:
      return 'success';
    case ImportedTransactionStatus.MERGED:
      return 'info';
    case ImportedTransactionStatus.IGNORED:
      return 'error';
    default:
      return 'warning';
  }
}

function TransactionDetails({
  transaction,
}: {
  transaction: ImportedTransaction;
}) {
  return (
    <Box>
      <Typography variant="body2">{transaction.description}</Typography>
      <Typography variant="caption" color="text.secondary">
        {formatAmount(transaction.value)} on {formatDate(transaction.date)}{' '}
        {transaction.type}
      </Typography>
    </Box>
  );
}

function MatchingDetails({
  transaction,
}: {
  transaction: ImportedTransaction;
}) {
  if (!transaction.matchingTransaction) {
    return (
      <Typography variant="body2" color="text.secondary">
        No match found
      </Typography>
    );
  }
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="body2">
          {transaction.matchingTransaction.description}
        </Typography>
        {transaction.matchingTransaction.status ===
          TransactionApprovalStatus.PENDING_APPROVAL && (
          <Tooltip title="From scheduled transaction">
            <EventRepeatIcon fontSize="small" color="info" />
          </Tooltip>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {formatAmount(transaction.matchingTransaction.value)} on{' '}
        {formatDate(transaction.matchingTransaction.date)}{' '}
        {transaction.matchingTransaction.type}
      </Typography>
    </Box>
  );
}

interface RowActionsProps {
  transaction: ImportedTransaction;
  disabled: boolean;
  compact: boolean;
  onMerge: (id: string) => void;
  onApprove: (id: string) => void;
  onIgnore: (id: string) => void;
  onDelete: (id: string) => void;
}

function RowActions({
  transaction,
  disabled,
  compact,
  onMerge,
  onApprove,
  onIgnore,
  onDelete,
}: RowActionsProps) {
  const isPending = transaction.status === ImportedTransactionStatus.PENDING;

  if (compact) {
    return (
      <Stack direction="row" spacing={0.5}>
        {isPending ? (
          <>
            {transaction.matchingTransaction && (
              <Tooltip title="Merge">
                <span>
                  <IconButton
                    size="small"
                    color="info"
                    disabled={disabled}
                    onClick={() => onMerge(transaction.id)}
                    aria-label="Merge"
                  >
                    <MergeIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <Tooltip title="Approve">
              <span>
                <IconButton
                  size="small"
                  color="success"
                  disabled={disabled}
                  onClick={() => onApprove(transaction.id)}
                  aria-label="Approve"
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Ignore">
              <span>
                <IconButton
                  size="small"
                  color="warning"
                  disabled={disabled}
                  onClick={() => onIgnore(transaction.id)}
                  aria-label="Ignore"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </>
        ) : (
          <Tooltip title="Delete">
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={disabled}
                onClick={() => onDelete(transaction.id)}
                aria-label="Delete"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Stack>
    );
  }

  return (
    <Stack direction="row" spacing={1}>
      {isPending ? (
        <>
          {transaction.matchingTransaction && (
            <Button
              variant="outlined"
              size="small"
              color="info"
              onClick={() => onMerge(transaction.id)}
              disabled={disabled}
              startIcon={<MergeIcon />}
            >
              Merge
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            color="success"
            onClick={() => onApprove(transaction.id)}
            disabled={disabled}
            startIcon={<CheckIcon />}
          >
            Approve
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="warning"
            onClick={() => onIgnore(transaction.id)}
            disabled={disabled}
            startIcon={<CloseIcon />}
          >
            Ignore
          </Button>
        </>
      ) : (
        <Button
          variant="outlined"
          size="small"
          color="error"
          onClick={() => onDelete(transaction.id)}
          disabled={disabled}
          startIcon={<DeleteIcon />}
        >
          Delete
        </Button>
      )}
    </Stack>
  );
}

const ImportedTransactionList: React.FC<ImportedTransactionListProps> = ({
  importId,
}) => {
  const { data: transactions = [], isLoading } =
    useImportedTransactionsQuery(importId);
  const approveMutation = useApproveImportedTransactionMutation(importId);
  const mergeMutation = useMergeImportedTransactionMutation(importId);
  const ignoreMutation = useIgnoreImportedTransactionMutation(importId);
  const deleteMutation = useDeleteImportedTransactionMutation(importId);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<ImportedTransaction | null>(null);
  const [formMode, setFormMode] = useState<'merge' | 'approve' | undefined>();
  const [pendingOperations, setPendingOperations] = useState<
    Record<string, string>
  >({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { data: autoApproveRules = [] } = useAutoApproveRulesQuery();
  const [statusFilter, setStatusFilter] = useState<string>(
    ImportedTransactionStatus.PENDING,
  );

  const chartColors = (theme.vars ?? theme).palette.charts;

  const activeTransactions = useMemo(
    () => transactions.filter((t) => !t.deleted),
    [transactions],
  );
  const filteredTransactions = useMemo(
    () =>
      statusFilter === 'ALL'
        ? activeTransactions
        : activeTransactions.filter((t) => t.status === statusFilter),
    [activeTransactions, statusFilter],
  );
  const pendingTransactions = useMemo(
    () =>
      activeTransactions.filter(
        (t) => t.status === ImportedTransactionStatus.PENDING,
      ),
    [activeTransactions],
  );
  const visiblePendingTransactions = useMemo(
    () =>
      filteredTransactions.filter(
        (t) => t.status === ImportedTransactionStatus.PENDING,
      ),
    [filteredTransactions],
  );
  const expenseTransactions = useMemo(
    () => filteredTransactions.filter((t) => t.type === 'EXPENSE'),
    [filteredTransactions],
  );
  const incomeTransactions = useMemo(
    () => filteredTransactions.filter((t) => t.type === 'INCOME'),
    [filteredTransactions],
  );

  const handleSelectAll = () => {
    setSelectedIds(new Set(visiblePendingTransactions.map((t) => t.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleMerge = (transactionId: string) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    if (transaction) {
      setSelectedTransaction(transaction);
      setFormMode('merge');
      setFormOpen(true);
    }
  };

  const handleApprove = (transactionId: string) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    if (transaction) {
      setSelectedTransaction(transaction);
      setFormMode('approve');
      setFormOpen(true);
    }
  };

  const handleIgnore = async (transactionId: string) => {
    setPendingOperations((prev) => ({ ...prev, [transactionId]: 'ignore' }));
    try {
      await ignoreMutation.mutateAsync(transactionId);
    } finally {
      setPendingOperations((prev) => {
        const updated = { ...prev };
        delete updated[transactionId];
        return updated;
      });
    }
  };

  const handleDelete = async (transactionId: string) => {
    setPendingOperations((prev) => ({ ...prev, [transactionId]: 'delete' }));
    try {
      await deleteMutation.mutateAsync(transactionId);
    } finally {
      setPendingOperations((prev) => {
        const updated = { ...prev };
        delete updated[transactionId];
        return updated;
      });
    }
  };

  const handleFormSubmit = async (data: CreateTransactionInput) => {
    if (!selectedTransaction) return;

    const operationType = formMode === 'merge' ? 'merge' : 'approve';
    setPendingOperations((prev) => ({
      ...prev,
      [selectedTransaction.id]: operationType,
    }));

    try {
      if (formMode === 'merge') {
        await mergeMutation.mutateAsync({
          id: selectedTransaction.id,
          data,
        });
      } else if (formMode === 'approve') {
        await approveMutation.mutateAsync({
          id: selectedTransaction.id,
          data,
        });
      }
      setFormOpen(false);
      setSelectedTransaction(null);
      setFormMode(undefined);
    } catch (error) {
      console.error('Error handling transaction:', error);
    } finally {
      setPendingOperations((prev) => {
        const updated = { ...prev };
        delete updated[selectedTransaction.id];
        return updated;
      });
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!activeTransactions.length) {
    return (
      <Typography color="text.secondary" align="center" py={2}>
        No transactions found
      </Typography>
    );
  }

  const sections: Array<{
    label: string;
    color: string;
    items: ImportedTransaction[];
  }> = [
    {
      label: `Expenses (${expenseTransactions.length})`,
      color: chartColors.expense,
      items: expenseTransactions,
    },
    {
      label: `Incomes (${incomeTransactions.length})`,
      color: chartColors.income,
      items: incomeTransactions,
    },
  ].filter((s) => s.items.length > 0);

  const sectionHeaderSx = (color: string) => ({
    borderLeft: 3,
    borderLeftColor: color,
    background: `color-mix(in srgb, ${color} 8%, transparent)`,
    fontWeight: 700,
    py: 0.75,
    px: 2,
  });

  const rowDisabled = (t: ImportedTransaction) => !!pendingOperations[t.id];

  const actionHandlers = {
    onMerge: handleMerge,
    onApprove: handleApprove,
    onIgnore: handleIgnore,
    onDelete: handleDelete,
  };

  const noMatches = sections.length === 0;

  return (
    <>
      <BatchActionToolbar
        importId={importId}
        selectedIds={Array.from(selectedIds)}
        pendingCount={pendingTransactions.length}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        hasAutoApproveRules={autoApproveRules.length > 0}
      />
      <Box sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="ALL">All</MenuItem>
            {Object.values(ImportedTransactionStatus).map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {noMatches && (
        <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
          No transactions match the selected filter.
        </Typography>
      )}

      {!noMatches && isMobile && (
        <Stack spacing={2}>
          {sections.map((section) => (
            <Box key={section.label}>
              <Typography variant="subtitle2" sx={{ ...sectionHeaderSx(section.color), mb: 1 }}>
                {section.label}
              </Typography>
              <Stack spacing={1}>
                {section.items.map((transaction) => (
                  <Card
                    key={transaction.id}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      bgcolor: selectedIds.has(transaction.id)
                        ? 'action.selected'
                        : 'background.paper',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      {transaction.status ===
                        ImportedTransactionStatus.PENDING && (
                        <Checkbox
                          size="small"
                          sx={{ p: 0.5, mt: -0.25 }}
                          checked={selectedIds.has(transaction.id)}
                          onChange={() => handleToggleSelect(transaction.id)}
                        />
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <TransactionDetails transaction={transaction} />
                        <Box sx={{ mt: 0.75 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            fontWeight={600}
                            display="block"
                          >
                            Match
                          </Typography>
                          <MatchingDetails transaction={transaction} />
                        </Box>
                      </Box>
                      <Chip
                        label={transaction.status}
                        color={getStatusColor(transaction.status)}
                        size="small"
                      />
                    </Stack>
                    <Stack
                      direction="row"
                      justifyContent="flex-end"
                      sx={{ mt: 1 }}
                    >
                      <RowActions
                        transaction={transaction}
                        disabled={rowDisabled(transaction)}
                        compact
                        {...actionHandlers}
                      />
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {!noMatches && !isMobile && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={
                      selectedIds.size > 0 &&
                      selectedIds.size < visiblePendingTransactions.length
                    }
                    checked={
                      visiblePendingTransactions.length > 0 &&
                      selectedIds.size === visiblePendingTransactions.length
                    }
                    onChange={(e) =>
                      e.target.checked
                        ? handleSelectAll()
                        : handleClearSelection()
                    }
                  />
                </TableCell>
                <TableCell>Transaction Details</TableCell>
                <TableCell>Matching Transaction</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sections.map((section) => (
                <React.Fragment key={section.label}>
                  <TableRow>
                    <TableCell colSpan={5} sx={sectionHeaderSx(section.color)}>
                      {section.label}
                    </TableCell>
                  </TableRow>
                  {section.items.map((transaction) => (
                    <TableRow
                      key={transaction.id}
                      selected={selectedIds.has(transaction.id)}
                    >
                      <TableCell padding="checkbox">
                        {transaction.status ===
                        ImportedTransactionStatus.PENDING ? (
                          <Checkbox
                            checked={selectedIds.has(transaction.id)}
                            onChange={() => handleToggleSelect(transaction.id)}
                          />
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <TransactionDetails transaction={transaction} />
                      </TableCell>
                      <TableCell>
                        <MatchingDetails transaction={transaction} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={transaction.status}
                          color={getStatusColor(transaction.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <RowActions
                          transaction={transaction}
                          disabled={rowDisabled(transaction)}
                          compact={false}
                          {...actionHandlers}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <TransactionForm
        open={formOpen}
        onCloseAction={() => {
          setFormOpen(false);
          setSelectedTransaction(null);
          setFormMode(undefined);
          if (selectedTransaction) {
            setPendingOperations((prev) => {
              const updated = { ...prev };
              delete updated[selectedTransaction.id];
              return updated;
            });
          }
        }}
        onSubmitAction={handleFormSubmit}
        initialData={
          formMode === 'merge' && selectedTransaction?.matchingTransaction
            ? selectedTransaction.matchingTransaction
            : selectedTransaction
              ? {
                  id: selectedTransaction.id,
                  description: selectedTransaction.description,
                  value: selectedTransaction.value,
                  date: selectedTransaction.date,
                  type: selectedTransaction.type as 'EXPENSE' | 'INCOME',
                  categoryId:
                    selectedTransaction.matchingTransaction?.categoryId || '',
                }
              : null
        }
        mode={formMode}
      />
    </>
  );
};

export default ImportedTransactionList;
