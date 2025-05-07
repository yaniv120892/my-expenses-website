import { Transaction } from "../types";
import { format } from "date-fns";

export function formatTransactionDate(date: string) {
  return format(new Date(date), "yyyy-MM-dd");
}

export function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

export function formatTransaction(transaction: Transaction) {
  return `${transaction.description} - ${formatCurrency(transaction.value)} (${
    transaction.category?.name || "N/A"
  }) on ${formatTransactionDate(transaction.date)}`;
}
