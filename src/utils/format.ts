import { Transaction } from "../types";
import { format } from "date-fns";

export function formatTransactionDate(date: string) {
  return format(new Date(date), "yyyy-MM-dd");
}

export function formatTransaction(transaction: Transaction) {
  return `${transaction.description} - (${
    transaction.category?.name || "N/A"
  }) on ${formatTransactionDate(transaction.date)}`;
}

export function formatNumber(value: number) {
  return value.toLocaleString();
}
