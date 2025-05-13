import { useState } from "react";
import {
  ScheduledTransaction,
  CreateScheduledTransactionInput,
  Category,
} from "../types";
import {
  getScheduledTransactions,
  createScheduledTransaction,
  deleteScheduledTransaction,
} from "../services/scheduledTransactions";
import { getCategories } from "../services/transactions";

export function useScheduledTransactions() {
  const [scheduledTransactions, setScheduledTransactions] = useState<
    ScheduledTransaction[]
  >([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScheduledTransactions = async () => {
    setLoading(true);
    try {
      const data = await getScheduledTransactions();
      setScheduledTransactions(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load scheduled transactions"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load categories");
    }
  };

  const handleCreate = async (data: CreateScheduledTransactionInput) => {
    await createScheduledTransaction(data);
    fetchScheduledTransactions();
  };

  const handleDelete = async (id: string) => {
    await deleteScheduledTransaction(id);
    fetchScheduledTransactions();
  };

  return {
    scheduledTransactions,
    categories,
    loading,
    error,
    fetchScheduledTransactions,
    fetchCategories,
    handleCreate,
    handleDelete,
    setError,
  };
}
