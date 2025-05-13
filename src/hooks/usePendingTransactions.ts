import { useState } from "react";
import { Transaction } from "../types";
import {
  getPendingTransactions,
  updateTransactionStatus,
  deleteTransaction,
} from "../services/transactions";

export function usePendingTransactions() {
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingTransactions = async () => {
    setLoading(true);
    try {
      const data = await getPendingTransactions();
      setPendingTransactions(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load pending transactions"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id: string) => {
    await updateTransactionStatus(id, "APPROVED");
    fetchPendingTransactions();
  };

  const handleDelete = async (id: string) => {
    await deleteTransaction(id);
    fetchPendingTransactions();
  };

  return {
    pendingTransactions,
    loading,
    error,
    fetchPendingTransactions,
    handleConfirm,
    handleDelete,
    setError,
  };
}
