import React from "react";
import {
  Box,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Stack,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  useImportedTransactionsQuery,
  useApproveImportedTransactionMutation,
  useRejectImportedTransactionMutation,
  useMergeImportedTransactionMutation,
  useDeleteImportedTransactionMutation,
} from "../hooks/useImports";
import { formatDate } from "../utils/dateUtils";
import { ImportedTransactionStatus } from "../types/import";

interface ImportedTransactionListProps {
  importId: string;
}

const ImportedTransactionList: React.FC<ImportedTransactionListProps> = ({
  importId,
}) => {
  const { data: transactions = [], isLoading } =
    useImportedTransactionsQuery(importId);
  const approveMutation = useApproveImportedTransactionMutation(importId);
  const mergeMutation = useMergeImportedTransactionMutation(importId);
  const rejectMutation = useRejectImportedTransactionMutation(importId);
  const deleteMutation = useDeleteImportedTransactionMutation(importId);

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
    }).format(value);
  };

  const handleApprove = async (transactionId: string) => {
    await approveMutation.mutateAsync(transactionId);
  };

  const handleMerge = async (transactionId: string) => {
    await mergeMutation.mutateAsync(transactionId);
  };

  const handleReject = async (transactionId: string) => {
    await rejectMutation.mutateAsync(transactionId);
  };

  const handleDelete = async (transactionId: string) => {
    await deleteMutation.mutateAsync(transactionId);
  };

  const getStatusColor = (status: ImportedTransactionStatus) => {
    switch (status) {
      case ImportedTransactionStatus.APPROVED:
        return "success";
      case ImportedTransactionStatus.MERGED:
        return "info";
      case ImportedTransactionStatus.IGNORED:
        return "error";
      default:
        return "warning";
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  const activeTransactions = transactions.filter((t) => !t.deleted);

  if (!activeTransactions.length) {
    return (
      <Typography color="var(--text-color)" align="center" py={2}>
        No transactions found
      </Typography>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Description</TableCell>
          <TableCell>Amount</TableCell>
          <TableCell>Date</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Matching Transaction</TableCell>
          <TableCell>Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {activeTransactions.map((transaction) => (
          <TableRow key={transaction.id}>
            <TableCell>{transaction.description}</TableCell>
            <TableCell>{formatAmount(transaction.value)}</TableCell>
            <TableCell>{formatDate(transaction.date)}</TableCell>
            <TableCell>
              <Chip
                label={transaction.type}
                color={transaction.type === "EXPENSE" ? "error" : "success"}
                size="small"
              />
            </TableCell>
            <TableCell>
              <Chip
                label={transaction.status}
                color={getStatusColor(transaction.status)}
                size="small"
              />
            </TableCell>
            <TableCell>
              {transaction.matchingTransaction ? (
                <Box>
                  <Typography variant="body2">
                    {transaction.matchingTransaction.description}
                  </Typography>
                  <Typography variant="caption" color="var(--text-color)">
                    {formatAmount(transaction.matchingTransaction.value)} on{" "}
                    {formatDate(transaction.matchingTransaction.date)}
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="var(--text-color)">
                  No match found
                </Typography>
              )}
            </TableCell>
            <TableCell>
              <Stack direction="row" spacing={1}>
                {transaction.status === ImportedTransactionStatus.PENDING && (
                  <>
                    {transaction.matchingTransaction ? (
                      <Button
                        variant="contained"
                        size="small"
                        color="info"
                        onClick={() => handleMerge(transaction.id)}
                        disabled={mergeMutation.isPending}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          minWidth: 80,
                        }}
                      >
                        Merge
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        size="small"
                        color="success"
                        onClick={() => handleApprove(transaction.id)}
                        disabled={approveMutation.isPending}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          minWidth: 80,
                        }}
                      >
                        Approve
                      </Button>
                    )}
                    <Button
                      variant="contained"
                      size="small"
                      color="error"
                      onClick={() => handleReject(transaction.id)}
                      disabled={rejectMutation.isPending}
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        minWidth: 80,
                      }}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {transaction.status !== ImportedTransactionStatus.PENDING && (
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(transaction.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Stack>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default ImportedTransactionList;
