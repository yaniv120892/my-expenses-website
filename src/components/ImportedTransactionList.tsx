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
import { useIsMobile } from '../hooks/useBreakpoints';
import type { ImportedTransaction } from '../types/import';
import { ImportedTransactionStatus, TransactionApprovalStatus } from '../types/import';
import TransactionForm from './TransactionForm';
import BatchActionToolbar from './BatchActionToolbar';
import NotificationSnackbar from './NotificationSnackbar';
import { describeApiError } from '../utils/api';
import { useErrorNotice } from '../hooks/useErrorNotice';
import type { CreateTransactionInput } from '../types';
import { useT } from '@/i18n/useT';
import type { T } from '@/i18n/useT.types';
import { useAppFormat } from '@/i18n/useAppFormat';

type ImportedTransactionListProps = {
  importId: string;
};

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

function typeLabel({ type, t }: { type: string; t: T }): string {
  switch (type) {
    case 'INCOME':
      return t('common.income');
    case 'EXPENSE':
      return t('common.expense');
    default:
      return type;
  }
}

function TransactionDetails({ transaction }: { transaction: ImportedTransaction }) {
  const t = useT();
  const formatter = useAppFormat();
  return (
    <Box>
      <Typography variant="body2">{transaction.description}</Typography>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
        }}
      >
        {t('imports.row.on', {
          amount: formatter.amountWithOriginal(transaction),
          date: formatter.day(transaction.date),
        })}{' '}
        {typeLabel({ type: transaction.type, t })}
      </Typography>
      <AmountWarning transaction={transaction} />
    </Box>
  );
}

function AmountWarning({ transaction }: { transaction: ImportedTransaction }) {
  const t = useT();
  if (transaction.value !== null && transaction.currency !== null) {
    return null;
  }
  return (
    <Chip
      size="small"
      color="warning"
      variant="outlined"
      sx={{ mt: 0.5 }}
      label={
        transaction.value === null
          ? t('imports.row.missingIlsAmount')
          : t('imports.row.currencyNotRecognised')
      }
    />
  );
}

function MatchingDetails({ transaction }: { transaction: ImportedTransaction }) {
  const t = useT();
  const formatter = useAppFormat();
  if (!transaction.matchingTransaction) {
    return (
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
        }}
      >
        {t('imports.row.noMatch')}
      </Typography>
    );
  }
  return (
    <Box>
      <Stack
        direction="row"
        spacing={0.5}
        sx={{
          alignItems: 'center',
        }}
      >
        <Typography variant="body2">{transaction.matchingTransaction.description}</Typography>
        {transaction.matchingTransaction.status === TransactionApprovalStatus.PENDING_APPROVAL && (
          <Tooltip title={t('imports.row.fromScheduled')}>
            <EventRepeatIcon fontSize="small" color="info" />
          </Tooltip>
        )}
      </Stack>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
        }}
      >
        {t('imports.row.on', {
          amount: formatter.amountWithOriginal(transaction.matchingTransaction),
          date: formatter.day(transaction.matchingTransaction.date),
        })}{' '}
        {typeLabel({ type: transaction.matchingTransaction.type, t })}
      </Typography>
    </Box>
  );
}

type RowActionsProps = {
  transaction: ImportedTransaction;
  disabled: boolean;
  compact: boolean;
  onMerge: (id: string) => void;
  onApprove: (id: string) => void;
  onIgnore: (id: string) => void;
  onDelete: (id: string) => void;
};

function RowActions({
  transaction,
  disabled,
  compact,
  onMerge,
  onApprove,
  onIgnore,
  onDelete,
}: RowActionsProps) {
  const t = useT();
  const isPending = transaction.status === ImportedTransactionStatus.PENDING;

  if (compact) {
    return (
      <Stack direction="row" spacing={0.5}>
        {isPending ? (
          <>
            {transaction.matchingTransaction && (
              <Tooltip title={t('imports.row.merge')}>
                <span>
                  <IconButton
                    size="small"
                    color="info"
                    disabled={disabled}
                    onClick={() => onMerge(transaction.id)}
                    aria-label={t('imports.row.merge')}
                  >
                    <MergeIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <Tooltip title={t('imports.row.approve')}>
              <span>
                <IconButton
                  size="small"
                  color="success"
                  disabled={disabled}
                  onClick={() => onApprove(transaction.id)}
                  aria-label={t('imports.row.approve')}
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('imports.row.ignore')}>
              <span>
                <IconButton
                  size="small"
                  color="warning"
                  disabled={disabled}
                  onClick={() => onIgnore(transaction.id)}
                  aria-label={t('imports.row.ignore')}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </>
        ) : (
          <Tooltip title={t('imports.row.delete')}>
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={disabled}
                onClick={() => onDelete(transaction.id)}
                aria-label={t('imports.row.delete')}
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
              {t('imports.row.merge')}
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
            {t('imports.row.approve')}
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="warning"
            onClick={() => onIgnore(transaction.id)}
            disabled={disabled}
            startIcon={<CloseIcon />}
          >
            {t('imports.row.ignore')}
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
          {t('imports.row.delete')}
        </Button>
      )}
    </Stack>
  );
}

const ImportedTransactionList: React.FC<ImportedTransactionListProps> = ({ importId }) => {
  const t = useT();
  const { data: transactions = [], isLoading } = useImportedTransactionsQuery(importId);
  const approveMutation = useApproveImportedTransactionMutation(importId);
  const mergeMutation = useMergeImportedTransactionMutation(importId);
  const ignoreMutation = useIgnoreImportedTransactionMutation(importId);
  const deleteMutation = useDeleteImportedTransactionMutation(importId);
  const theme = useTheme();
  const isMobile = useIsMobile();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<ImportedTransaction | null>(null);
  const [formMode, setFormMode] = useState<'merge' | 'approve' | undefined>();
  const [pendingOperations, setPendingOperations] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { showError, snackbarProps } = useErrorNotice();
  const { data: autoApproveRules = [] } = useAutoApproveRulesQuery();
  const [statusFilter, setStatusFilter] = useState<string>(ImportedTransactionStatus.PENDING);

  const chartColors = (theme.vars ?? theme).palette.charts;

  const activeTransactions = useMemo(() => transactions.filter((t) => !t.deleted), [transactions]);
  const filteredTransactions = useMemo(
    () =>
      statusFilter === 'ALL'
        ? activeTransactions
        : activeTransactions.filter((t) => t.status === statusFilter),
    [activeTransactions, statusFilter],
  );
  const pendingTransactions = useMemo(
    () => activeTransactions.filter((t) => t.status === ImportedTransactionStatus.PENDING),
    [activeTransactions],
  );
  const visiblePendingTransactions = useMemo(
    () => filteredTransactions.filter((t) => t.status === ImportedTransactionStatus.PENDING),
    [filteredTransactions],
  );
  // Rows leave view on a filter change or once decided; a batch must never act on them.
  const effectiveSelectedIds = useMemo(
    () => new Set(visiblePendingTransactions.map((t) => t.id).filter((id) => selectedIds.has(id))),
    [visiblePendingTransactions, selectedIds],
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
    const next = new Set(effectiveSelectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
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
    } catch (error) {
      showError(describeApiError(error, t('imports.row.ignoreFailed')));
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
    } catch (error) {
      showError(describeApiError(error, t('imports.row.deleteFailed')));
    } finally {
      setPendingOperations((prev) => {
        const updated = { ...prev };
        delete updated[transactionId];
        return updated;
      });
    }
  };

  // Must not catch: the form reports the outcome.
  const handleFormSubmit = async (data: CreateTransactionInput) => {
    // Resolving without writing would read as a successful save.
    if (!selectedTransaction || !formMode) {
      throw new Error(
        `No imported row selected for submit (transaction: ${selectedTransaction?.id}, mode: ${formMode})`,
      );
    }

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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          p: 2,
        }}
      >
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!activeTransactions.length) {
    return (
      <Typography
        align="center"
        sx={{
          color: 'text.secondary',
          py: 2,
        }}
      >
        {t('imports.row.empty')}
      </Typography>
    );
  }

  const sections: {
    label: string;
    color: string;
    items: ImportedTransaction[];
  }[] = [
    {
      label: t('imports.row.expenses', {
        count: expenseTransactions.length,
      }),
      color: chartColors.negative,
      items: expenseTransactions,
    },
    {
      label: t('imports.row.incomes', { count: incomeTransactions.length }),
      color: chartColors.positive,
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
        selectedIds={Array.from(effectiveSelectedIds)}
        pendingCount={pendingTransactions.length}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        hasAutoApproveRules={autoApproveRules.length > 0}
        onErrorAction={showError}
      />
      <Box sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>{t('imports.list.status')}</InputLabel>
          <Select
            value={statusFilter}
            label={t('imports.list.status')}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="ALL">{t('common.all')}</MenuItem>
            {Object.values(ImportedTransactionStatus).map((status) => (
              <MenuItem key={status} value={status}>
                {t(`imports.row.status.${status}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {noMatches && (
        <Typography
          align="center"
          sx={{
            color: 'text.secondary',
            py: 3,
          }}
        >
          {t('imports.row.noFilterMatches')}
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
                      bgcolor: effectiveSelectedIds.has(transaction.id)
                        ? 'action.selected'
                        : 'background.paper',
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        alignItems: 'flex-start',
                      }}
                    >
                      {transaction.status === ImportedTransactionStatus.PENDING && (
                        <Checkbox
                          size="small"
                          sx={{ p: 0.5, mt: -0.25 }}
                          checked={effectiveSelectedIds.has(transaction.id)}
                          onChange={() => handleToggleSelect(transaction.id)}
                          slotProps={{
                            input: {
                              'aria-label': t('imports.row.selectRow', {
                                description: transaction.description,
                              }),
                            },
                          }}
                        />
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <TransactionDetails transaction={transaction} />
                        <Box sx={{ mt: 0.75 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              fontWeight: 600,
                              display: 'block',
                            }}
                          >
                            {t('imports.row.match')}
                          </Typography>
                          <MatchingDetails transaction={transaction} />
                        </Box>
                      </Box>
                      <Chip
                        label={t(`imports.row.status.${transaction.status}`)}
                        color={getStatusColor(transaction.status)}
                        size="small"
                      />
                    </Stack>
                    <Stack
                      direction="row"
                      sx={{
                        justifyContent: 'flex-end',
                        mt: 1,
                      }}
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
                      effectiveSelectedIds.size > 0 &&
                      effectiveSelectedIds.size < visiblePendingTransactions.length
                    }
                    checked={
                      visiblePendingTransactions.length > 0 &&
                      effectiveSelectedIds.size === visiblePendingTransactions.length
                    }
                    onChange={(e) =>
                      e.target.checked ? handleSelectAll() : handleClearSelection()
                    }
                    slotProps={{
                      input: { 'aria-label': t('imports.row.selectAllRows') },
                    }}
                  />
                </TableCell>
                <TableCell>{t('imports.row.details')}</TableCell>
                <TableCell>{t('imports.row.matching')}</TableCell>
                <TableCell>{t('imports.list.status')}</TableCell>
                <TableCell>{t('imports.row.actions')}</TableCell>
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
                      selected={effectiveSelectedIds.has(transaction.id)}
                    >
                      <TableCell padding="checkbox">
                        {transaction.status === ImportedTransactionStatus.PENDING ? (
                          <Checkbox
                            checked={effectiveSelectedIds.has(transaction.id)}
                            onChange={() => handleToggleSelect(transaction.id)}
                            slotProps={{
                              input: {
                                'aria-label': t('imports.row.selectRow', {
                                  description: transaction.description,
                                }),
                              },
                            }}
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
                          label={t(`imports.row.status.${transaction.status}`)}
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
                  currency: selectedTransaction.currency,
                  originalAmount: selectedTransaction.originalAmount,
                  exchangeRate: selectedTransaction.exchangeRate,
                  exchangeRateSource: selectedTransaction.exchangeRateSource,
                  date: selectedTransaction.date,
                  type: selectedTransaction.type as 'EXPENSE' | 'INCOME',
                  categoryId: selectedTransaction.matchingTransaction?.categoryId || '',
                }
              : null
        }
        mode={formMode}
      />
      <NotificationSnackbar {...snackbarProps} />
    </>
  );
};

export default ImportedTransactionList;
