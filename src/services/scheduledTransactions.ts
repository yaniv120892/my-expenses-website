import api from "./api";
import {
  ScheduledTransaction,
  CreateScheduledTransactionInput,
  UpdateScheduledTransactionInput,
} from "../types";

async function getScheduledTransactions(): Promise<ScheduledTransaction[]> {
  const res = await api.get("/api/scheduled-transactions");
  return res.data;
}

async function createScheduledTransaction(
  data: CreateScheduledTransactionInput
): Promise<string> {
  const res = await api.post("/api/scheduled-transactions", data);
  return res.data;
}

async function updateScheduledTransaction(
  id: string,
  data: UpdateScheduledTransactionInput
): Promise<string> {
  const res = await api.put(`/api/scheduled-transactions/${id}`, data);
  return res.data;
}

async function deleteScheduledTransaction(id: string): Promise<void> {
  await api.delete(`/api/scheduled-transactions/${id}`);
}

export {
  getScheduledTransactions,
  createScheduledTransaction,
  updateScheduledTransaction,
  deleteScheduledTransaction,
};
