import React, { useState } from "react";
import { Transaction, TransactionFilters } from "../../types";
import TransactionList from "../../components/TransactionList";
import TransactionForm from "../../components/TransactionForm";
import SearchBar from "../../components/SearchBar";
import TransactionListSkeleton from "../../components/TransactionListSkeleton";
import { Fab, Box } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useTransactions } from "../../hooks/useTransactions";

function TransactionSearch({
  onSearch,
}: {
  onSearch: (params: TransactionFilters) => void;
}) {
  return (
    <Box sx={{ minWidth: 260, maxWidth: 320 }}>
      <SearchBar onSearch={onSearch} />
    </Box>
  );
}

function TransactionTableArea({
  loading,
  transactions,
  onEdit,
  onDelete,
  onFabClick,
}: {
  loading: boolean;
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onFabClick: () => void;
}) {
  return (
    <Box flex={1} sx={{ position: "relative" }}>
      {loading ? (
        <TransactionListSkeleton rows={6} />
      ) : (
        <TransactionList
          transactions={transactions}
          onEditAction={onEdit}
          onDeleteAction={onDelete}
        />
      )}
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: "absolute", bottom: 16, right: 16, zIndex: 2000 }}
        onClick={onFabClick}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
}

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

  const handleFabClick = () => {
    setFormOpen(true);
    setEditTx(null);
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
      <TransactionSearch onSearch={handleSearch} />
      <TransactionTableArea
        loading={loading}
        transactions={transactions}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onFabClick={handleFabClick}
      />
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
