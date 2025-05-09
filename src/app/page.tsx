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
} from "../services/transactions";
import TransactionList from "../components/TransactionList";
import TransactionForm from "../components/TransactionForm";
import SearchBar from "../components/SearchBar";
import TransactionListSkeleton from "../components/TransactionListSkeleton";
import Navbar from "../components/Navbar";
import { Box, Snackbar, Alert, Fab } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

export default function HomePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    fetchTransactions();
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
          onTabChange={(tab) => setActiveTab(tab as "transactions" | "summary")}
        />
        <Box sx={{ flex: 1, pl: 3 }}>
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
            ></Box>
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
                onClose={() => {
                  setFormOpen(false);
                  setEditTx(null);
                }}
                onSubmit={editTx ? handleUpdate : handleCreate}
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
