import React, { useState } from "react";
import { Transaction, TransactionFilters } from "../../types";
import TransactionList from "../../components/TransactionList";
import TransactionForm from "../../components/TransactionForm";
import TransactionListSkeleton from "../../components/TransactionListSkeleton";
import { Fab, Box } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchDialog from "../../components/SearchDialog";
import SearchIcon from "@mui/icons-material/Search";
import { useTransactions } from "../../hooks/useTransactions";

function TransactionTableArea({
  loading,
  transactions,
  onEdit,
  onDelete,
}: {
  loading: boolean;
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
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
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [lastSearch, setLastSearch] = useState<TransactionFilters | undefined>(
    undefined
  );

  React.useEffect(() => {
    fetchTransactions();
  }, []);

  const handleSearch = (params: TransactionFilters) => {
    setLastSearch(params);
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

  const handleSearchFabClick = () => {
    setSearchDialogOpen(true);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 3,
        position: "relative",
      }}
    >
      <TransactionTableArea
        loading={loading}
        transactions={transactions}
        onEdit={handleEdit}
        onDelete={handleDelete}
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
      <Box
        sx={{
          position: "fixed",
          bottom: 32,
          right: 32,
          display: "flex",
          flexDirection: "row",
          gap: 2,
          zIndex: 2000,
        }}
      >
        <Fab color="primary" aria-label="add" onClick={handleFabClick}>
          <AddIcon />
        </Fab>
        <Fab
          color="secondary"
          aria-label="search"
          onClick={handleSearchFabClick}
        >
          <SearchIcon />
        </Fab>
      </Box>
      <SearchDialog
        open={searchDialogOpen}
        onClose={() => setSearchDialogOpen(false)}
        onSearch={handleSearch}
        initialFilters={lastSearch}
      />
    </Box>
  );
}
