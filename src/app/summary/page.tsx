"use client";

import React, { useEffect, useState } from "react";
import { getTransactions } from "../../services/transactions";
import { Transaction } from "../../types";
import SummaryToggle from "../../components/SummaryToggle";
import SummaryChart from "../../components/SummaryChart";
import { Box, CircularProgress, Alert } from "@mui/material";
import { format } from "date-fns";

type Mode = "category" | "month";

export default function SummaryPage() {
  const [mode, setMode] = useState<Mode>("category");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getTransactions({ perPage: 1000 })])
      .then(([txs]) => {
        setTransactions(txs);
      })
      .catch((e) => setError(e.message || "Failed to load transactions"))
      .finally(() => setLoading(false));
  }, []);

  // Group by category or month
  const getData = () => {
    if (mode === "category") {
      const byCategory: { [cat: string]: number } = {};
      transactions.forEach((tx) => {
        if (tx.type === "EXPENSE") {
          byCategory[tx.category.name] =
            (byCategory[tx.category.name] || 0) + tx.value;
        }
      });
      return byCategory;
    } else {
      const byMonth: { [month: string]: number } = {};
      transactions.forEach((tx) => {
        if (tx.type === "EXPENSE") {
          const month = format(new Date(tx.date), "yyyy-MM");
          byMonth[month] = (byMonth[month] || 0) + tx.value;
        }
      });
      return byMonth;
    }
  };

  return (
    <Box>
      <SummaryToggle value={mode} onChange={setMode} />
      {loading ? (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <SummaryChart
          data={getData()}
          label={
            mode === "category" ? "Expenses by Category" : "Expenses by Month"
          }
        />
      )}
    </Box>
  );
}
