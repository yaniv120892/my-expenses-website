"use client";

import React from "react";
import { Transaction } from "../types";
import { formatTransactionDate } from "../utils/format";
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
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: 3,
        boxShadow: 3,
        mt: 2,
        mb: 2,
        overflow: "hidden",
      }}
    >
      <Table sx={{ minWidth: 650 }}>
        <TableHead>
          <TableRow sx={{ backgroundColor: "primary.main" }}>
            <TableCell
              sx={{ color: "white", fontWeight: "bold", fontSize: "1.1rem" }}
            >
              Description
            </TableCell>
            <TableCell
              sx={{ color: "white", fontWeight: "bold", fontSize: "1.1rem" }}
            >
              Value
            </TableCell>
            <TableCell
              sx={{ color: "white", fontWeight: "bold", fontSize: "1.1rem" }}
            >
              Type
            </TableCell>
            <TableCell
              sx={{ color: "white", fontWeight: "bold", fontSize: "1.1rem" }}
            >
              Category
            </TableCell>
            <TableCell
              sx={{ color: "white", fontWeight: "bold", fontSize: "1.1rem" }}
            >
              Date
            </TableCell>
            <TableCell
              align="right"
              sx={{ color: "white", fontWeight: "bold", fontSize: "1.1rem" }}
            >
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((tx, idx) => (
            <TableRow
              key={tx.id}
              sx={{
                backgroundColor:
                  idx % 2 === 0 ? "background.paper" : "grey.100",
                transition: "background 0.2s",
                "&:hover": {
                  backgroundColor: "grey.200",
                },
              }}
            >
              <TableCell sx={{ fontSize: "1rem" }}>{tx.description}</TableCell>
              <TableCell sx={{ fontSize: "1rem" }}>{tx.value}</TableCell>
              <TableCell sx={{ fontSize: "1rem", textTransform: "capitalize" }}>
                {tx.type}
              </TableCell>
              <TableCell sx={{ fontSize: "1rem" }}>
                {tx.category?.name}
              </TableCell>
              <TableCell sx={{ fontSize: "1rem" }}>
                {formatTransactionDate(tx.date)}
              </TableCell>
              <TableCell align="right">
                <IconButton
                  onClick={() => onEdit(tx)}
                  size="small"
                  sx={{ mr: 1 }}
                >
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
