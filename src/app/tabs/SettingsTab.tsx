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
import { useForm, Controller } from "react-hook-form";

type UserSettingsForm = {
  provider: {
    telegramChatId: string;
  };
  notifications: {
    createTransaction: boolean;
    dailySummary: boolean;
  };
  info: {
    email: string;
  };
};

export default function SettingsTab() {
  const {
    settings,
    loading,
    error,
    fetchUserSettings,
    saveUserSettings,
    testTelegramConnection,
  } = useUserSettings();
  const [testResult, setTestResult] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const { control, handleSubmit, reset, watch, formState } = useForm({
    defaultValues: {
      provider: { telegramChatId: "" },
      notifications: { createTransaction: false, dailySummary: false },
      info: { email: "" },
    },
    mode: "onChange",
  });

  useEffect(() => {
    fetchUserSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      reset({
        provider: {
          ...settings.provider,
          telegramChatId: settings.provider.telegramChatId || "",
        },
        notifications: { ...settings.notifications },
        info: { ...settings.info },
      });
    }
  }, [settings, reset]);

  const watchedValues = watch();
  const isDirty = formState.isDirty;

  const handleTestTelegram = async () => {
    setTestResult("");
    setTestLoading(true);
    const result = await testTelegramConnection(
      watchedValues.provider.telegramChatId
    );
    if (result.success) {
      setTestResult("Test message sent successfully");
    } else {
      setTestResult(result.message || "Failed to send test message");
    }
    setTestLoading(false);
  };

  const onSave = async (data: UserSettingsForm) => {
    setSaveLoading(true);
    await saveUserSettings({
      ...data,
      provider: {
        enabled: data.provider.telegramChatId ? true : false,
        telegramChatId: data.provider.telegramChatId,
      },
    });
    setSaveLoading(false);
  };

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
          Email: {watchedValues.info.email}
        </Typography>
        <Box mt={2} display="flex" alignItems="center" gap={1}>
          <Controller
            name="provider.telegramChatId"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                label="Telegram Chat ID"
                {...field}
                error={!!fieldState.error}
                helperText={fieldState.error?.message || ""}
                size="small"
                sx={{ flex: 1 }}
              />
            )}
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
            disabled={
              testLoading ||
              !watchedValues.provider.telegramChatId ||
              !!formState.errors.provider?.telegramChatId
            }
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
        <Controller
          name="notifications.createTransaction"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  sx={{ color: "var(--primary)" }}
                />
              }
              label="Notify on new transaction creation"
            />
          )}
        />
        <Controller
          name="notifications.dailySummary"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  sx={{ color: "var(--primary)" }}
                />
              }
              label="Daily summary notification"
            />
          )}
        />
        <Divider sx={{ my: 2 }} />
        <Box display="flex" justifyContent="flex-end" gap={2}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit(onSave)}
            disabled={
              !isDirty ||
              saveLoading ||
              !!formState.errors.provider?.telegramChatId
            }
          >
            {saveLoading ? "Saving..." : "Save"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
