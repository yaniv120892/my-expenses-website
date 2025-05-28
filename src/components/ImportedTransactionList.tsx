import React, { useState } from "react";
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
  useTheme,
  useMediaQuery,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import MergeIcon from "@mui/icons-material/MergeType";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import {
  useImportedTransactionsQuery,
  useApproveImportedTransactionMutation,
  useMergeImportedTransactionMutation,
  useDeleteImportedTransactionMutation,
  useIgnoreImportedTransactionMutation,
} from "../hooks/useImports";
import { formatDate } from "../utils/dateUtils";
import {
  ImportedTransactionStatus,
  ImportedTransaction,
} from "../types/import";
import TransactionForm from "./TransactionForm";
import { CreateTransactionInput } from "../types";

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
  const ignoreMutation = useIgnoreImportedTransactionMutation(importId);
  const deleteMutation = useDeleteImportedTransactionMutation(importId);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<ImportedTransaction | null>(null);
  const [formMode, setFormMode] = useState<"merge" | "approve" | undefined>();
  const [pendingOperations, setPendingOperations] = useState<
    Record<string, string>
  >({});

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
    }).format(value);
  };

  const handleMerge = async (transactionId: string) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    if (transaction) {
      setSelectedTransaction(transaction);
      setFormMode("merge");
      setFormOpen(true);
    }
  };

  const handleApprove = async (transactionId: string) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    if (transaction) {
      setSelectedTransaction(transaction);
      setFormMode("approve");
      setFormOpen(true);
    }
  };

  const handleIgnore = async (transactionId: string) => {
    setPendingOperations((prev) => ({ ...prev, [transactionId]: "ignore" }));
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
    setPendingOperations((prev) => ({ ...prev, [transactionId]: "delete" }));
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

    const operationType = formMode === "merge" ? "merge" : "approve";
    setPendingOperations((prev) => ({
      ...prev,
      [selectedTransaction.id]: operationType,
    }));

    try {
      if (formMode === "merge") {
        await mergeMutation.mutateAsync({
          id: selectedTransaction.id,
          data,
        });
      } else if (formMode === "approve") {
        await approveMutation.mutateAsync({
          id: selectedTransaction.id,
          data,
        });
      }
      setFormOpen(false);
      setSelectedTransaction(null);
      setFormMode(undefined);
    } catch (error) {
      console.error("Error handling transaction:", error);
    } finally {
      setPendingOperations((prev) => {
        const updated = { ...prev };
        delete updated[selectedTransaction.id];
        return updated;
      });
    }
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
    <>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Transaction Details</TableCell>
            <TableCell>Matching Transaction</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {activeTransactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell>
                <Box>
                  <Typography variant="body2">
                    {transaction.description}
                  </Typography>
                  <Typography variant="caption" color="var(--text-color)">
                    {formatAmount(transaction.value)} on{" "}
                    {formatDate(transaction.date)} {transaction.type}
                  </Typography>
                </Box>
              </TableCell>

              <TableCell>
                {transaction.matchingTransaction ? (
                  <Box>
                    <Typography variant="body2">
                      {transaction.matchingTransaction.description}
                    </Typography>
                    <Typography variant="caption" color="var(--text-color)">
                      {formatAmount(transaction.matchingTransaction.value)} on{" "}
                      {formatDate(transaction.matchingTransaction.date)}{" "}
                      {transaction.matchingTransaction.type}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="var(--text-color)">
                    No match found
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Chip
                  label={transaction.status}
                  color={getStatusColor(transaction.status)}
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} justifyContent="center">
                  {transaction.status === ImportedTransactionStatus.PENDING && (
                    <>
                      {transaction.matchingTransaction ? (
                        <Button
                          variant="contained"
                          size="small"
                          color="info"
                          onClick={() => handleMerge(transaction.id)}
                          disabled={!!pendingOperations[transaction.id]}
                          startIcon={!isMobile && <MergeIcon />}
                          sx={{
                            textTransform: "none",
                            fontWeight: 700,
                            minWidth: isMobile ? 40 : 80,
                            p: isMobile ? 1 : undefined,
                          }}
                        >
                          {isMobile ? <MergeIcon /> : "Merge"}
                        </Button>
                      ) : (
                        <Button
                          variant="contained"
                          size="small"
                          color="success"
                          onClick={() => handleApprove(transaction.id)}
                          disabled={!!pendingOperations[transaction.id]}
                          startIcon={!isMobile && <CheckIcon />}
                          sx={{
                            textTransform: "none",
                            fontWeight: 700,
                            minWidth: isMobile ? 40 : 80,
                            p: isMobile ? 1 : undefined,
                          }}
                        >
                          {isMobile ? <CheckIcon /> : "Approve"}
                        </Button>
                      )}
                      <Button
                        variant="contained"
                        size="small"
                        color="warning"
                        onClick={() => handleIgnore(transaction.id)}
                        disabled={!!pendingOperations[transaction.id]}
                        startIcon={!isMobile && <CloseIcon />}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          minWidth: isMobile ? 40 : 80,
                          p: isMobile ? 1 : undefined,
                        }}
                      >
                        {isMobile ? <CloseIcon /> : "Ignore"}
                      </Button>
                    </>
                  )}
                  {transaction.status !== ImportedTransactionStatus.PENDING && (
                    <Button
                      variant="contained"
                      size="small"
                      color="error"
                      onClick={() => handleDelete(transaction.id)}
                      disabled={!!pendingOperations[transaction.id]}
                      startIcon={!isMobile && <DeleteIcon />}
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        minWidth: isMobile ? 40 : 80,
                        p: isMobile ? 1 : undefined,
                      }}
                    >
                      {isMobile ? <DeleteIcon /> : "Delete"}
                    </Button>
                  )}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
          formMode === "merge" && selectedTransaction?.matchingTransaction
            ? selectedTransaction.matchingTransaction
            : selectedTransaction
            ? {
                id: selectedTransaction.id,
                description: selectedTransaction.description,
                value: selectedTransaction.value,
                date: selectedTransaction.date,
                type: selectedTransaction.type as "EXPENSE" | "INCOME",
                categoryId:
                  selectedTransaction.matchingTransaction?.categoryId || "",
              }
            : null
        }
        mode={formMode}
      />
    </>
  );
};

export default ImportedTransactionList;
