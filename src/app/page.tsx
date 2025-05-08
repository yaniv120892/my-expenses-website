"use client";

import React, { useEffect, useState } from "react";
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
  getTransactionSummary,
} from "../services/transactions";
import TransactionList from "../components/TransactionList";
import TransactionForm from "../components/TransactionForm";
import SearchBar from "../components/SearchBar";
import SummaryChart from "../components/SummaryChart";
import TransactionListSkeleton from "../components/TransactionListSkeleton";
import {
  Box,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  AppBar,
  Tabs,
  Tab,
  Toolbar,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

export default function HomePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    totalIncome: number;
    totalExpense: number;
  } | null>(null);
  const [summaryMode, setSummaryMode] = useState<"category" | "month">(
    "category"
  );
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"transactions" | "summary">(
    "transactions"
  );

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

  const fetchSummary = async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await getTransactionSummary({});
      console.log("summary data", data);
      const totalIncome = data?.totalIncome || 0;
      const totalExpense = data?.totalExpense || 0;
      setSummary({ totalIncome, totalExpense });
    } catch (e) {
      setSummaryError(
        e instanceof Error ? e.message : "Failed to load summary"
      );
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchSummary();
  }, []);

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
    <Box sx={{ minHeight: "100vh", py: 4 }}>
      <AppBar position="static" color="default" elevation={1} sx={{ mb: 4 }}>
        <Toolbar>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab label="Transactions" value="transactions" />
            <Tab label="Summary" value="summary" />
          </Tabs>
        </Toolbar>
      </AppBar>
      {activeTab === "summary" ? (
        <Box
          mb={3}
          sx={{
            background: "#fff",
            borderRadius: 3,
            boxShadow: "0 2px 16px 0 rgba(60,72,100,0.08)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            p: { xs: 2, sm: 4 },
          }}
        >
          {summaryLoading ? (
            <Box display="flex" justifyContent="center" mt={2}>
              <CircularProgress />
            </Box>
          ) : summaryError ? (
            <Alert severity="error">{summaryError}</Alert>
          ) : (
            <SummaryChart
              totalIncome={summary?.totalIncome || 0}
              totalExpense={summary?.totalExpense || 0}
            />
          )}
        </Box>
      ) : (
        <>
          <Box
            mb={3}
            sx={{
              background: "#fff",
              borderRadius: 3,
              boxShadow: "0 2px 16px 0 rgba(60,72,100,0.08)",
              display: "flex",
              alignItems: "center",
              gap: 2,
              p: { xs: 2, sm: 3 },
            }}
          >
            <Box flex={1}>
              <SearchBar onSearch={handleSearch} />
            </Box>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setFormOpen(true)}
              startIcon={<AddIcon />}
              sx={{
                borderRadius: 2,
                fontWeight: 600,
                px: 3,
                py: 1.2,
                boxShadow: "0 2px 8px 0 rgba(60,72,100,0.08)",
                textTransform: "none",
                fontSize: "1rem",
              }}
            >
              New Transaction
            </Button>
          </Box>
          {loading ? (
            <TransactionListSkeleton rows={6} />
          ) : (
            <TransactionList
              transactions={transactions}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
          <TransactionForm
            open={formOpen}
            onClose={() => {
              setFormOpen(false);
              setEditTx(null);
            }}
            onSubmit={editTx ? handleUpdate : handleCreate}
            initialData={editTx}
          />
        </>
      )}
      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={() => setError(null)}
      >
        <Alert severity="error">{error}</Alert>
      </Snackbar>
    </Box>
  );
}
