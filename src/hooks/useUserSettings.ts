import { useState } from "react";
import { UserSettings } from "../types";
import {
  getUserSettings,
  updateUserSettings,
  testTelegram,
} from "../services/userSettingsService";

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchUserSettings() {
    setLoading(true);
    try {
      const data = await getUserSettings();
      setSettings(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load user settings");
    } finally {
      setLoading(false);
    }
  }

  async function saveUserSettings(updated: UserSettings) {
    try {
      await updateUserSettings(updated);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to update user settings"
      );
    }
  }

  async function testTelegramConnection(chatId: string) {
    try {
      return await testTelegram(chatId);
    } catch (e) {
      return {
        success: false,
        message:
          e instanceof Error ? e.message : "Failed to test Telegram connection",
      };
    }
  }

  return {
    settings,
    loading,
    error,
    fetchUserSettings,
    saveUserSettings,
    setError,
    testTelegramConnection,
  };
}
