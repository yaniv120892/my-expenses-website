import api from './api';
import type {
  ScheduledTransaction,
  CreateScheduledTransactionInput,
  UpdateScheduledTransactionInput,
} from '../types';

async function getScheduledTransactions(): Promise<ScheduledTransaction[]> {
  const response = await api.get('/api/scheduled-transactions');
  return response.data;
}

async function createScheduledTransaction(data: CreateScheduledTransactionInput): Promise<string> {
  const response = await api.post('/api/scheduled-transactions', data);
  return response.data;
}

async function updateScheduledTransaction(
  id: string,
  data: UpdateScheduledTransactionInput,
): Promise<string> {
  const response = await api.put(`/api/scheduled-transactions/${id}`, data);
  return response.data;
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
