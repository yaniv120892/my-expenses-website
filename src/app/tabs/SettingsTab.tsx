"use client";
import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Paper,
  Divider,
  Alert,
  TextField,
  Tooltip,
  IconButton,
  Button,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useUserSettings } from "@/hooks/useUserSettings";
import SettingsTabSkeleton from "@/components/SettingsTabSkeleton";

export default function SettingsTab() {
  const {
    settings,
    loading,
    error,
    fetchUserSettings,
    saveUserSettings,
    testTelegramConnection,
  } = useUserSettings();
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramChatIdError, setTelegramChatIdError] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    fetchUserSettings();
  }, []);

  useEffect(() => {
    if (settings && settings.provider && settings.provider.telegramChatId) {
      setTelegramChatId(settings.provider.telegramChatId);
    }
  }, [settings]);

  function handleToggle(name: "createTransaction" | "dailySummary") {
    if (!settings) {
      return;
    }
    saveUserSettings({
      info: settings.info,
      notifications: {
        ...settings.notifications,
        [name]: !settings.notifications[name],
      },
      provider: settings.provider,
    });
  }

  async function handleTelegramChatIdChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const value = e.target.value;
    setTelegramChatId(value);
    setTelegramChatIdError("");
    setTestResult(null);
    if (!settings) {
      return;
    }
    if (value && !/^\d+$/.test(value)) {
      setTelegramChatIdError("Chat ID must be a number");
      return;
    }
    await saveUserSettings({
      ...settings,
      provider: {
        ...settings.provider,
        telegramChatId: value,
      },
    });
  }

  async function handleTestTelegram() {
    setTestResult(null);
    setTestLoading(true);
    const result = await testTelegramConnection(telegramChatId);
    if (result.success) {
      setTestResult("Test message sent successfully");
    } else {
      setTestResult(result.message || "Failed to send test message");
    }
    setTestLoading(false);
  }

  if (loading) {
    return <SettingsTabSkeleton />;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!settings) {
    return <Alert severity="error">Failed to load settings</Alert>;
  }

  return (
    <Box maxWidth={500} mx="auto" mt={4}>
      <Paper
        elevation={3}
        sx={{ p: 3, mb: 4, backgroundColor: "var(--secondary)" }}
      >
        <Typography variant="h6" gutterBottom color="var(--primary)">
          Info
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="body1" color="var(--primary)">
          Email: {settings.info.email}
        </Typography>
        <Box mt={2} display="flex" alignItems="center" gap={1}>
          <TextField
            label="Telegram Chat ID"
            value={telegramChatId}
            onChange={handleTelegramChatIdChange}
            error={!!telegramChatIdError}
            helperText={telegramChatIdError || ""}
            size="small"
            sx={{ flex: 1 }}
          />
          <Tooltip title="To get your chat ID, create a new group on Telegram, add my-expenses-bot to the group, and send a message: @WhatIsMyChatId. The bot will reply with your chat ID. Copy it here.">
            <IconButton size="small">
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            size="small"
            onClick={handleTestTelegram}
            disabled={testLoading || !telegramChatId || !!telegramChatIdError}
            sx={{ minWidth: 80 }}
          >
            {testLoading ? "Testing..." : "Test"}
          </Button>
        </Box>
        {testResult && (
          <Box mt={1}>
            <Alert
              severity={
                testResult === "Test message sent successfully"
                  ? "success"
                  : "error"
              }
            >
              {testResult}
            </Alert>
          </Box>
        )}
      </Paper>
      <Paper elevation={3} sx={{ p: 3, backgroundColor: "var(--secondary)" }}>
        <Typography variant="h6" gutterBottom color="var(--primary)">
          Notifications
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <FormControlLabel
          control={
            <Switch
              checked={settings.notifications.createTransaction}
              onChange={() => handleToggle("createTransaction")}
              sx={{ color: "var(--primary)" }}
            />
          }
          label="Notify on new transaction creation"
        />
        <FormControlLabel
          control={
            <Switch
              checked={settings.notifications.dailySummary}
              onChange={() => handleToggle("dailySummary")}
              sx={{ color: "var(--primary)" }}
            />
          }
          label="Daily summary notification"
        />
        <Divider sx={{ my: 2 }} />
      </Paper>
    </Box>
  );
}
