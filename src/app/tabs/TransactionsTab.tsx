import React, { useState } from "react";
import { Transaction, TransactionFilters } from "../../types";
import TransactionList from "../../components/TransactionList";
import TransactionForm from "../../components/TransactionForm";
import SearchBar from "../../components/SearchBar";
import TransactionListSkeleton from "../../components/TransactionListSkeleton";
import { Fab, Box } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useTransactions } from "../../hooks/useTransactions";

export default function TransactionsTab() {
  const {
    transactions,
    loading,
    fetchTransactions,
    handleCreate,
    handleUpdate,
    handleDelete,
  } = useTransactions();
  const [formOpen, setFormOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);

  React.useEffect(() => {
    fetchTransactions();
  }, []);

  const handleSearch = (params: TransactionFilters) => {
    fetchTransactions(params);
  };

  const handleEdit = (tx: Transaction) => {
    setEditTx(tx);
    setFormOpen(true);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 3,
      }}
    >
      <Box sx={{ minWidth: 260, maxWidth: 320 }}>
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
        <Fab
          color="primary"
          aria-label="add"
          sx={{ position: "fixed", bottom: 32, right: 32, zIndex: 2000 }}
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
        onSubmitAction={
          editTx ? (data) => handleUpdate(editTx.id, data) : handleCreate
        }
        initialData={editTx}
      />
    </Box>
  );
}
