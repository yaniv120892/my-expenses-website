"use client";
import React, { useEffect, useState } from "react";
import NotificationSnackbar from "./NotificationSnackbar";
import { usePendingTransactionsQuery } from "../hooks/usePendingTransactionsQuery";

const STORAGE_KEY = "pendingTransactionsSeenDate";

function getTodayKey() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export default function PendingTransactionsPopup() {
  const { data: pendingTransactions = [] } = usePendingTransactionsQuery();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pendingTransactions.length > 0) {
      const today = getTodayKey();
      const seenDate = localStorage.getItem(STORAGE_KEY);
      if (seenDate !== today) {
        setOpen(true);
        localStorage.setItem(STORAGE_KEY, today);
      }
    }
  }, [pendingTransactions.length]);

  const handleClose = () => setOpen(false);

  if (pendingTransactions.length === 0) return null;

  return (
    <NotificationSnackbar
      open={open}
      message={`Hi - you have ${pendingTransactions.length} pending transaction${pendingTransactions.length > 1 ? 's' : ''} - take a look!`}
      severity="info"
      onClose={handleClose}
      autoHideDuration={6000}
    />
  );
}
