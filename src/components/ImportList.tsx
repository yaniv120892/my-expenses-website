'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  Chip,
  Collapse,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Import, ImportStatus } from '../types/import';
import { useIsMobile } from '../hooks/useBreakpoints';
import {
  useImportsQuery,
  useDeleteImportMutation,
  useRematchImportMutation,
} from '../hooks/useImports';
import ImportedTransactionList from './ImportedTransactionList';
import { comparePaymentMonths } from '../utils/paymentMonth';
import EmptyState from './EmptyState';
import ImportListSkeleton from './ImportListSkeleton';
import { useT } from '@/i18n/useT';
import { useAppFormat } from '@/i18n/useAppFormat';

type SortField = 'createdAt' | 'paymentMonth' | 'status';
type SortDirection = 'asc' | 'desc';

function getStatusColor(status: ImportStatus) {
  switch (status) {
    case ImportStatus.COMPLETED:
      return 'success';
    case ImportStatus.FAILED:
      return 'error';
    case ImportStatus.PROCESSING:
    case ImportStatus.REMATCHING:
      return 'primary';
    case ImportStatus.MERGED:
    default:
      return 'default';
  }
}

type RowActionsProps = {
  importItem: Import;
  onDeleteClick: (importItem: Import) => void;
  onRematchClick: (importItem: Import) => void;
  isRematching: boolean;
};

function RowActions({
  importItem,
  onDeleteClick,
  onRematchClick,
  isRematching,
}: RowActionsProps) {
  const t = useT();
  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{
        justifyContent: 'flex-end',
      }}
    >
      {importItem.status === ImportStatus.COMPLETED &&
        !importItem.isVerified && (
          <IconButton
            size="small"
            color="primary"
            disabled={isRematching}
            aria-label={t('imports.list.rematch')}
            title={t('imports.list.rematch')}
            onClick={(e) => {
              e.stopPropagation();
              onRematchClick(importItem);
            }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        )}
      <IconButton
        size="small"
        color="error"
        aria-label={t('imports.list.delete')}
        onClick={(e) => {
          e.stopPropagation();
          onDeleteClick(importItem);
        }}
      >
        <DeleteOutlinedIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function ExpandedContent({ importItem }: { importItem: Import }) {
  const t = useT();
  return (
    <Box sx={{ py: 2, px: { xs: 1, md: 3 } }}>
      {importItem.status === ImportStatus.COMPLETED && (
        <ImportedTransactionList importId={importItem.id} />
      )}
      {importItem.status === ImportStatus.FAILED && (
        <Typography color="error" variant="body2">
          {t('imports.list.error', { error: importItem.error ?? '' })}
        </Typography>
      )}
      {importItem.status === ImportStatus.MERGED && (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          {t('imports.list.mergedInto', {
            fileName:
              importItem.mergedIntoFileName ??
              t('imports.list.mergedIntoUnknown'),
          })}
        </Typography>
      )}
    </Box>
  );
}

type ImportListProps = {
  onImportClick: (importId: string) => void;
  expandedImportId: string | null;
};

export default function ImportList({
  onImportClick,
  expandedImportId,
}: ImportListProps) {
  const t = useT();
  const formatter = useAppFormat();
  const { data: imports = [], isLoading } = useImportsQuery();
  const deleteImportMutation = useDeleteImportMutation();
  const rematchImportMutation = useRematchImportMutation();
  const isMobile = useIsMobile();

  const [deleteTarget, setDeleteTarget] = useState<Import | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentMonthFilter, setPaymentMonthFilter] = useState<string>('ALL');
  const [cardFilter, setCardFilter] = useState<string>('ALL');
  const [isVerifiedFilter, setIsVerifiedFilter] = useState<
    'ALL' | 'true' | 'false'
  >('false');

  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const filterOptions = useMemo(() => {
    const paymentMonths = Array.from(
      new Set(
        imports
          .map((i) => i.paymentMonth)
          .filter((month): month is string => Boolean(month)),
      ),
    ).sort(comparePaymentMonths);
    const cards = Array.from(
      new Set(
        imports
          .map((i) => i.creditCardLastFourDigits)
          .filter((card): card is string => Boolean(card)),
      ),
    ).sort();
    return { paymentMonths, cards };
  }, [imports]);

  const filteredImports = useMemo(() => {
    const result = imports.filter((imp) => {
      if (statusFilter !== 'ALL' && imp.status !== statusFilter) {
        return false;
      }
      if (
        paymentMonthFilter !== 'ALL' &&
        imp.paymentMonth !== paymentMonthFilter
      ) {
        return false;
      }
      if (cardFilter !== 'ALL' && imp.creditCardLastFourDigits !== cardFilter) {
        return false;
      }
      if (
        isVerifiedFilter !== 'ALL' &&
        imp.isVerified !== (isVerifiedFilter === 'true')
      ) {
        return false;
      }
      return true;
    });

    return [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'createdAt':
          cmp =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'paymentMonth':
          cmp = comparePaymentMonths(a.paymentMonth, b.paymentMonth);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [
    imports,
    statusFilter,
    paymentMonthFilter,
    cardFilter,
    isVerifiedFilter,
    sortField,
    sortDirection,
  ]);

  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteImportMutation.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return <ImportListSkeleton rows={6} />;
  }

  if (!imports.length) {
    return <EmptyState message={t('imports.list.empty')} />;
  }

  const filterBar = (
    <Stack
      direction="row"
      spacing={1.5}
      useFlexGap
      sx={{
        flexWrap: 'wrap',
        alignItems: 'center',
        mb: 2,
      }}
    >
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel>{t('imports.list.status')}</InputLabel>
        <Select
          value={statusFilter}
          label={t('imports.list.status')}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <MenuItem value="ALL">{t('common.all')}</MenuItem>
          {Object.values(ImportStatus).map((status) => (
            <MenuItem key={status} value={status}>
              {t(`imports.status.${status}`)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>{t('imports.list.paymentMonth')}</InputLabel>
        <Select
          value={paymentMonthFilter}
          label={t('imports.list.paymentMonth')}
          onChange={(e) => setPaymentMonthFilter(e.target.value)}
        >
          <MenuItem value="ALL">{t('common.all')}</MenuItem>
          {filterOptions.paymentMonths.map((m) => (
            <MenuItem key={m} value={m}>
              {m}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel>{t('imports.list.card')}</InputLabel>
        <Select
          value={cardFilter}
          label={t('imports.list.card')}
          onChange={(e) => setCardFilter(e.target.value)}
        >
          <MenuItem value="ALL">{t('common.all')}</MenuItem>
          {filterOptions.cards.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <ToggleButtonGroup
        value={isVerifiedFilter}
        exclusive
        size="small"
        onChange={(_, newValue) => {
          if (newValue !== null) {
            setIsVerifiedFilter(newValue);
          }
        }}
      >
        <ToggleButton value="ALL">{t('common.all')}</ToggleButton>
        <ToggleButton value="true">{t('imports.list.verified')}</ToggleButton>
        <ToggleButton value="false">
          {t('imports.list.notVerified')}
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );

  const deleteDialog = (
    <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
      <DialogTitle>{t('imports.list.deleteTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('imports.list.deleteBody', {
            fileName: deleteTarget?.originalFileName ?? '',
          })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDeleteTarget(null)}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDeleteConfirm}
          disabled={deleteImportMutation.isPending}
        >
          {t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (isMobile) {
    return (
      <>
        {filterBar}
        <Stack spacing={1.5}>
          {filteredImports.map((importItem) => {
            const isExpanded = expandedImportId === importItem.id;
            return (
              <Card key={importItem.id} variant="outlined">
                <Box
                  onClick={() => onImportClick(importItem.id)}
                  sx={{ p: 1.5, cursor: 'pointer' }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          wordBreak: 'break-all',
                        }}
                      >
                        {importItem.originalFileName}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                        }}
                      >
                        {t('imports.list.cardAndMonth', {
                          card:
                            importItem.creditCardLastFourDigits ||
                            t('imports.list.notAvailable'),
                          month:
                            importItem.paymentMonth ||
                            t('imports.list.notAvailable'),
                        })}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          display: 'block',
                        }}
                      >
                        {t('imports.list.createdAndUpdated', {
                          created: formatter.dateTime(importItem.createdAt),
                          updated: formatter.dateTime(importItem.updatedAt),
                        })}
                      </Typography>
                    </Box>
                    {isExpanded ? (
                      <KeyboardArrowUpIcon color="action" />
                    ) : (
                      <KeyboardArrowDownIcon color="action" />
                    )}
                  </Stack>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: 'center',
                      mt: 1,
                    }}
                  >
                    <Chip
                      label={t(`imports.status.${importItem.status}`)}
                      color={getStatusColor(importItem.status)}
                      size="small"
                    />
                    {importItem.isVerified ? (
                      <CheckCircleOutlinedIcon
                        color="success"
                        fontSize="small"
                      />
                    ) : (
                      <CancelOutlinedIcon color="warning" fontSize="small" />
                    )}
                    <Box sx={{ flex: 1 }} />
                    <RowActions
                      importItem={importItem}
                      onDeleteClick={setDeleteTarget}
                      onRematchClick={(imp) =>
                        rematchImportMutation.mutate(imp.id)
                      }
                      isRematching={rematchImportMutation.isPending}
                    />
                  </Stack>
                </Box>
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
                    <ExpandedContent importItem={importItem} />
                  </Box>
                </Collapse>
              </Card>
            );
          })}
          {filteredImports.length === 0 && (
            <Typography
              align="center"
              sx={{
                color: 'text.secondary',
                py: 4,
              }}
            >
              {t('imports.list.noFilterMatches')}
            </Typography>
          )}
        </Stack>
        {deleteDialog}
      </>
    );
  }

  return (
    <>
      {filterBar}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 48 }} />
              <TableCell>{t('imports.list.card')}</TableCell>
              <TableCell
                sortDirection={
                  sortField === 'paymentMonth' ? sortDirection : false
                }
              >
                <TableSortLabel
                  active={sortField === 'paymentMonth'}
                  direction={
                    sortField === 'paymentMonth' ? sortDirection : 'asc'
                  }
                  onClick={() => handleSortClick('paymentMonth')}
                >
                  {t('imports.list.paymentMonth')}
                </TableSortLabel>
              </TableCell>
              <TableCell>{t('imports.list.fileName')}</TableCell>
              <TableCell
                sortDirection={sortField === 'status' ? sortDirection : false}
              >
                <TableSortLabel
                  active={sortField === 'status'}
                  direction={sortField === 'status' ? sortDirection : 'asc'}
                  onClick={() => handleSortClick('status')}
                >
                  {t('imports.list.status')}
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">{t('imports.list.verified')}</TableCell>
              <TableCell
                sortDirection={
                  sortField === 'createdAt' ? sortDirection : false
                }
              >
                <TableSortLabel
                  active={sortField === 'createdAt'}
                  direction={sortField === 'createdAt' ? sortDirection : 'asc'}
                  onClick={() => handleSortClick('createdAt')}
                >
                  {t('imports.list.createdAt')}
                </TableSortLabel>
              </TableCell>
              <TableCell>{t('imports.list.updatedAt')}</TableCell>
              <TableCell sx={{ width: 80 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredImports.map((importItem) => {
              const isExpanded = expandedImportId === importItem.id;
              return (
                <React.Fragment key={importItem.id}>
                  <TableRow
                    hover
                    onClick={() => onImportClick(importItem.id)}
                    sx={{ cursor: 'pointer', '& > td': { borderBottom: 0 } }}
                  >
                    <TableCell>
                      {isExpanded ? (
                        <KeyboardArrowUpIcon fontSize="small" color="action" />
                      ) : (
                        <KeyboardArrowDownIcon
                          fontSize="small"
                          color="action"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {importItem.creditCardLastFourDigits ||
                        t('imports.list.notAvailable')}
                    </TableCell>
                    <TableCell>
                      {importItem.paymentMonth ||
                        t('imports.list.notAvailable')}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Typography
                        variant="body2"
                        noWrap
                        title={importItem.originalFileName}
                      >
                        {importItem.originalFileName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t(`imports.status.${importItem.status}`)}
                        color={getStatusColor(importItem.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      {importItem.isVerified ? (
                        <CheckCircleOutlinedIcon
                          color="success"
                          fontSize="small"
                        />
                      ) : (
                        <CancelOutlinedIcon color="warning" fontSize="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      {formatter.dateTime(importItem.createdAt)}
                    </TableCell>
                    <TableCell>
                      {formatter.dateTime(importItem.updatedAt)}
                    </TableCell>
                    <TableCell align="right">
                      <RowActions
                        importItem={importItem}
                        onDeleteClick={setDeleteTarget}
                        onRematchClick={(imp) =>
                          rematchImportMutation.mutate(imp.id)
                        }
                        isRematching={rematchImportMutation.isPending}
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={9} sx={{ p: 0 }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <ExpandedContent importItem={importItem} />
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
            {filteredImports.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('imports.list.noFilterMatches')}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {deleteDialog}
    </>
  );
}
