"use client";

import React, { useEffect, useState } from "react";
import {
  Transaction,
  TransactionFilters,
  CreateTransactionInput,
  UpdateTransactionInput,
  Category,
  ScheduledTransaction,
} from "../types";
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getCategories,
} from "../services/transactions";
import {
  getScheduledTransactions,
  deleteScheduledTransaction,
} from "../services/scheduledTransactions";
import TransactionList from "../components/TransactionList";
import TransactionForm from "../components/TransactionForm";
import SearchBar from "../components/SearchBar";
import TransactionListSkeleton from "../components/TransactionListSkeleton";
import Navbar from "../components/Navbar";
import ScheduledTransactionList from "../components/ScheduledTransactionList";
import { Box, Snackbar, Alert, Fab } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SummaryChart from "@/components/SummaryChart";

export default function HomePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [scheduledTransactions, setScheduledTransactions] = useState<
    ScheduledTransaction[]
  >([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "transactions" | "summary" | "scheduled-transactions"
  >("transactions");

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

  const fetchScheduledTransactions = async () => {
    setScheduledLoading(true);
    try {
      const data = await getScheduledTransactions();
      setScheduledTransactions(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load scheduled transactions"
      );
    } finally {
      setScheduledLoading(false);
    }
  };

  const fetchAllCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load categories");
    }
  };

  useEffect(() => {
    if (activeTab === "transactions") {
      fetchTransactions();
    }
    if (activeTab === "scheduled-transactions") {
      fetchScheduledTransactions();
      fetchAllCategories();
    }
  }, [activeTab]);

  const handleSearch = (params: TransactionFilters) => {
    fetchTransactions(params);
  };

  const handleCreate = async (data: CreateTransactionInput) => {
    await createTransaction(data);
    fetchTransactions();
  };

  const handleEdit = (tx: Transaction) => {
    setEditTx(tx);
    setFormOpen(true);
  };

  const handleUpdate = async (data: UpdateTransactionInput) => {
    if (editTx) {
      await updateTransaction(editTx.id, data);
      setEditTx(null);
      fetchTransactions();
    }
  };

  const handleDelete = async (id: string) => {
    await deleteTransaction(id);
    fetchTransactions();
  };

  return (
    <div>
      <Box
        sx={{
          minHeight: "100vh",
          py: 4,
          display: "flex",
          flexDirection: "row",
        }}
      >
        <Navbar
          activeTab={activeTab}
          onTabChange={(tab) =>
            setActiveTab(
              tab as "transactions" | "summary" | "scheduled-transactions"
            )
          }
        />
        <Box sx={{ flex: 1, pl: 3 }}>
          {activeTab === "summary" ? (
            <SummaryChart />
          ) : activeTab === "scheduled-transactions" ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {scheduledLoading ? (
                <TransactionListSkeleton rows={6} />
              ) : (
                <ScheduledTransactionList
                  scheduledTransactions={scheduledTransactions}
                  categories={categories}
                  onEditAction={() => {}}
                  onDeleteAction={async (id) => {
                    await deleteScheduledTransaction(id);
                    fetchScheduledTransactions();
                  }}
                />
              )}
            </Box>
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 3,
              }}
            >
              <Box
                sx={{
                  minWidth: 260,
                  maxWidth: 320,
                }}
              >
                <SearchBar onSearch={handleSearch} />
              </Box>
              <Box flex={1} sx={{ position: "relative" }}>
                {loading ? (
                  <TransactionListSkeleton rows={6} />
                ) : (
                  <TransactionList
                    transactions={transactions}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                )}
                {/* Floating Action Button */}
                <Fab
                  color="primary"
                  aria-label="add"
                  sx={{
                    position: "fixed",
                    bottom: 32,
                    right: 32,
                    zIndex: 2000,
                  }}
                  onClick={() => {
                    setFormOpen(true);
                    setEditTx(null);
                  }}
                >
                  <AddIcon />
                </Fab>
              </Box>
              <TransactionForm
                open={formOpen}
                onCloseAction={() => {
                  setFormOpen(false);
                  setEditTx(null);
                }}
                onSubmitAction={editTx ? handleUpdate : handleCreate}
                initialData={editTx}
              />
            </Box>
          )}
          <Snackbar
            open={!!error}
            autoHideDuration={4000}
            onClose={() => setError(null)}
          >
            <Alert severity="error">{error}</Alert>
          </Snackbar>
        </Box>
      </Box>
    </div>
  );
}
