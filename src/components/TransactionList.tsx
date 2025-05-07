"use client";

import React from "react";
import { Transaction } from "../types";
import { formatTransactionDate, formatCurrency } from "../utils/format";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

type Props = {
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
};

export default function TransactionList({
  transactions,
  onEdit,
  onDelete,
}: Props) {
  if (!transactions.length) {
    return <Typography>No transactions found.</Typography>;
  }

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Description</TableCell>
            <TableCell>Value</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Date</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell>{tx.description}</TableCell>
              <TableCell>{formatCurrency(tx.value)}</TableCell>
              <TableCell>{tx.type}</TableCell>
              <TableCell>{tx.category?.name}</TableCell>
              <TableCell>{formatTransactionDate(tx.date)}</TableCell>
              <TableCell align="right">
                <IconButton onClick={() => onEdit(tx)} size="small">
                  <EditIcon />
                </IconButton>
                <IconButton
                  onClick={() => onDelete(tx.id)}
                  size="small"
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
