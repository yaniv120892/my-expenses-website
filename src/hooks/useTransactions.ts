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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };
  const handleCreate = async (data: CreateTransactionInput) => {
    await createTransaction(data);
    fetchTransactions();
  };
  const handleUpdate = async (id: string, data: UpdateTransactionInput) => {
    await updateTransaction(id, data);
    fetchTransactions();
  };
  const handleDelete = async (id: string) => {
    await deleteTransaction(id);
    fetchTransactions();
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
