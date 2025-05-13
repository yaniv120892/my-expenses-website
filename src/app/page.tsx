"use client";

import React, { useEffect, useState } from "react";
import {
  Transaction,
  TransactionFilters,
  CreateTransactionInput,
  UpdateTransactionInput,
  Category,
  ScheduledTransaction,
  CreateScheduledTransactionInput,
} from "../types";
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getCategories,
  getPendingTransactions,
  updateTransactionStatus,
} from "../services/transactions";
import {
  getScheduledTransactions,
  deleteScheduledTransaction,
  createScheduledTransaction,
} from "../services/scheduledTransactions";
import TransactionList from "../components/TransactionList";
import TransactionForm from "../components/TransactionForm";
import SearchBar from "../components/SearchBar";
import TransactionListSkeleton from "../components/TransactionListSkeleton";
import Navbar from "../components/Navbar";
import ScheduledTransactionList from "../components/ScheduledTransactionList";
import ScheduledTransactionForm from "../components/ScheduledTransactionForm";
import PendingTransactionsList from "../components/PendingTransactionsList";
import { Box, Snackbar, Alert, Fab } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SummaryChart from "@/components/SummaryChart";

export default function HomePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [scheduledTransactions, setScheduledTransactions] = useState<
    ScheduledTransaction[]
  >([]);
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>(
    []
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [scheduledFormOpen, setScheduledFormOpen] = useState(false);
  const [editScheduledTx, setEditScheduledTx] =
    useState<ScheduledTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "transactions"
    | "summary"
    | "scheduled-transactions"
    | "pending-transactions"
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

  const fetchPendingTransactions = async () => {
    setPendingLoading(true);
    try {
      const data = await getPendingTransactions();
      setPendingTransactions(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load pending transactions"
      );
    } finally {
      setPendingLoading(false);
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
    if (activeTab === "pending-transactions") {
      fetchPendingTransactions();
    }
  }, [activeTab]);

  const handleSearch = (params: TransactionFilters) => {
    fetchTransactions(params);
  };

  const handleCreate = async (data: CreateTransactionInput) => {
    await createTransaction(data);
    fetchTransactions();
  };

  const handleCreateScheduled = async (
    data: CreateScheduledTransactionInput
  ) => {
    await createScheduledTransaction(data);
    fetchScheduledTransactions();
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

  const handleConfirmPending = async (id: string) => {
    await updateTransactionStatus(id, "APPROVED");
    fetchPendingTransactions();
  };

  const handleDeletePending = async (id: string) => {
    await deleteTransaction(id);
    fetchPendingTransactions();
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
              tab as
                | "transactions"
                | "summary"
                | "scheduled-transactions"
                | "pending-transactions"
            )
          }
        />
        <Box sx={{ flex: 1, pl: 3 }}>
          {activeTab === "summary" ? (
            <SummaryChart />
          ) : activeTab === "scheduled-transactions" ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                position: "relative",
              }}
            >
              {scheduledLoading ? (
                <TransactionListSkeleton rows={6} />
              ) : (
                <ScheduledTransactionList
                  scheduledTransactions={scheduledTransactions}
                  categories={categories}
                  onEditAction={(tx) => {
                    setEditScheduledTx(tx);
                    setScheduledFormOpen(true);
                  }}
                  onDeleteAction={async (id) => {
                    await deleteScheduledTransaction(id);
                    fetchScheduledTransactions();
                  }}
                />
              )}
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
                  setScheduledFormOpen(true);
                  setEditScheduledTx(null);
                }}
              >
                <AddIcon />
              </Fab>
              <ScheduledTransactionForm
                open={scheduledFormOpen}
                onCloseAction={() => {
                  setScheduledFormOpen(false);
                  setEditScheduledTx(null);
                }}
                onSubmitAction={handleCreateScheduled}
                initialData={editScheduledTx}
              />
            </Box>
          ) : activeTab === "pending-transactions" ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                position: "relative",
              }}
            >
              {pendingLoading ? (
                <TransactionListSkeleton rows={6} />
              ) : (
                <PendingTransactionsList
                  transactions={pendingTransactions}
                  onConfirmAction={handleConfirmPending}
                  onDeleteAction={handleDeletePending}
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
                    onEditAction={handleEdit}
                    onDeleteAction={handleDelete}
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
