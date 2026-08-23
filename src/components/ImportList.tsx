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
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Import, ImportStatus } from '../types/import';
import { useIsMobile } from '../hooks/useBreakpoints';
import {
  useImportsQuery,
  useDeleteImportMutation,
  useRematchImportMutation,
} from '../hooks/useImports';
import ImportedTransactionList from './ImportedTransactionList';
import { formatDate } from '../utils/dateUtils';
import EmptyState from './EmptyState';
import ImportListSkeleton from './ImportListSkeleton';

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
    default:
      return 'default';
  }
}

interface RowActionsProps {
  importItem: Import;
  onDeleteClick: (importItem: Import) => void;
  onRematchClick: (importItem: Import) => void;
  isRematching: boolean;
}

function RowActions({
  importItem,
  onDeleteClick,
  onRematchClick,
  isRematching,
}: RowActionsProps) {
  return (
    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
      {importItem.status === ImportStatus.COMPLETED &&
        !importItem.isVerified && (
          <IconButton
            size="small"
            color="primary"
            disabled={isRematching}
            aria-label="Re-match"
            title="Re-match"
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
        aria-label="Delete import"
        onClick={(e) => {
          e.stopPropagation();
          onDeleteClick(importItem);
        }}
      >
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function ExpandedContent({ importItem }: { importItem: Import }) {
  return (
    <Box sx={{ py: 2, px: { xs: 1, md: 3 } }}>
      {importItem.status === ImportStatus.COMPLETED && (
        <ImportedTransactionList importId={importItem.id} />
      )}
      {importItem.status === ImportStatus.FAILED && (
        <Typography color="error" variant="body2">
          Error: {importItem.error}
        </Typography>
      )}
    </Box>
  );
}

interface ImportListProps {
  onImportClick: (importId: string) => void;
  expandedImportId: string | null;
}

export default function ImportList({
  onImportClick,
  expandedImportId,
}: ImportListProps) {
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
      new Set(imports.map((i) => i.paymentMonth).filter(Boolean)),
    ).sort() as string[];
    const cards = Array.from(
      new Set(imports.map((i) => i.creditCardLastFourDigits).filter(Boolean)),
    ).sort() as string[];
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
          cmp = (a.paymentMonth || '').localeCompare(b.paymentMonth || '');
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
    return <EmptyState message="No imports found." />;
  }

  const filterBar = (
    <Stack
      direction="row"
      spacing={1.5}
      useFlexGap
      flexWrap="wrap"
      alignItems="center"
      sx={{ mb: 2 }}
    >
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel>Status</InputLabel>
        <Select
          value={statusFilter}
          label="Status"
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <MenuItem value="ALL">All</MenuItem>
          {Object.values(ImportStatus).map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Payment Month</InputLabel>
        <Select
          value={paymentMonthFilter}
          label="Payment Month"
          onChange={(e) => setPaymentMonthFilter(e.target.value)}
        >
          <MenuItem value="ALL">All</MenuItem>
          {filterOptions.paymentMonths.map((m) => (
            <MenuItem key={m} value={m}>
              {m}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel>Card (Last 4)</InputLabel>
        <Select
          value={cardFilter}
          label="Card (Last 4)"
          onChange={(e) => setCardFilter(e.target.value)}
        >
          <MenuItem value="ALL">All</MenuItem>
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
        <ToggleButton value="ALL">All</ToggleButton>
        <ToggleButton value="true">Verified</ToggleButton>
        <ToggleButton value="false">Not Verified</ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );

  const deleteDialog = (
    <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
      <DialogTitle>Delete Import</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete the import &quot;
          {deleteTarget?.originalFileName}&quot;? This action cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDeleteConfirm}
          disabled={deleteImportMutation.isPending}
        >
          Delete
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
                    justifyContent="space-between"
                    alignItems="flex-start"
                    spacing={1}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ wordBreak: 'break-all' }}
                      >
                        {importItem.originalFileName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Card: {importItem.creditCardLastFourDigits || 'N/A'}{' '}
                        &bull; Month: {importItem.paymentMonth || 'N/A'}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        Created: {formatDate(importItem.createdAt, true)} &bull;
                        Updated: {formatDate(importItem.updatedAt, true)}
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
                    alignItems="center"
                    spacing={1}
                    sx={{ mt: 1 }}
                  >
                    <Chip
                      label={importItem.status}
                      color={getStatusColor(importItem.status)}
                      size="small"
                    />
                    {importItem.isVerified ? (
                      <CheckCircleOutlineIcon
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
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              No imports match the selected filters.
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
              <TableCell>Card (Last 4)</TableCell>
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
                  Payment Month
                </TableSortLabel>
              </TableCell>
              <TableCell>File Name</TableCell>
              <TableCell
                sortDirection={sortField === 'status' ? sortDirection : false}
              >
                <TableSortLabel
                  active={sortField === 'status'}
                  direction={sortField === 'status' ? sortDirection : 'asc'}
                  onClick={() => handleSortClick('status')}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">Verified</TableCell>
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
                  Created At
                </TableSortLabel>
              </TableCell>
              <TableCell>Updated At</TableCell>
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
                      {importItem.creditCardLastFourDigits || 'N/A'}
                    </TableCell>
                    <TableCell>{importItem.paymentMonth || 'N/A'}</TableCell>
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
                        label={importItem.status}
                        color={getStatusColor(importItem.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      {importItem.isVerified ? (
                        <CheckCircleOutlineIcon
                          color="success"
                          fontSize="small"
                        />
                      ) : (
                        <CancelOutlinedIcon color="warning" fontSize="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDate(importItem.createdAt, true)}
                    </TableCell>
                    <TableCell>
                      {formatDate(importItem.updatedAt, true)}
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
                  <Typography color="text.secondary">
                    No imports match the selected filters.
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
