import { useState } from "react";
import {
  Transaction,
  TransactionFilters,
  CreateTransactionInput,
  UpdateTransactionInput,
} from "../types";
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "../services/transactions";

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async (params?: TransactionFilters) => {
    setLoading(true);
    try {
      const data = await getTransactions(params);
      setTransactions(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (
    data: CreateTransactionInput,
    filters?: TransactionFilters
  ) => {
    try {
      await createTransaction(data);
      await fetchTransactions(filters);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create transaction");
    }
  };

  const handleUpdate = async (
    id: string,
    data: UpdateTransactionInput,
    filters?: TransactionFilters
  ) => {
    try {
      await updateTransaction(id, data);
      await fetchTransactions(filters);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update transaction");
    }
  };

  const handleDelete = async (id: string, filters?: TransactionFilters) => {
    try {
      await deleteTransaction(id);
      await fetchTransactions(filters);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete transaction");
    }
  };

  return {
    transactions,
    loading,
    error,
    fetchTransactions,
    handleCreate,
    handleUpdate,
    handleDelete,
    setError,
  };
}
