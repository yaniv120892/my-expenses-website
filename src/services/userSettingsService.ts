import api from './api';
import type {
  TelegramLinkCode,
  UpdateUserSettings,
  UserSettings,
} from '../types';

export async function getUserSettings(): Promise<UserSettings> {
  const response = await api.get('/api/user/settings');
  return response.data;
}

export async function updateUserSettings(
  settings: UpdateUserSettings,
): Promise<UserSettings> {
  const response = await api.put('/api/user/settings', settings);
  return response.data;
}

export async function testTelegram(): Promise<{
  success: boolean;
  message: string;
}> {
  const response = await api.post('/api/user/settings/test-telegram');
  return response.data;
}

export async function createTelegramLinkCode(): Promise<TelegramLinkCode> {
  const response = await api.post('/api/user/settings/telegram-link');
  return response.data;
}

export async function unlinkTelegram(): Promise<void> {
  await api.delete('/api/user/settings/telegram-link');
}

export async function testMonthlyReport(): Promise<{
  success: boolean;
  message: string;
}> {
  const response = await api.post('/api/user/settings/test-monthly-report');
  return response.data;
}
