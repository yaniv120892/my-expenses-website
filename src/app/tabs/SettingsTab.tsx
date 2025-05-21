"use client";
import React, { useEffect } from "react";
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Paper,
  Divider,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useUserSettings } from "@/hooks/useUserSettings";

export default function SettingsTab() {
  const { settings, loading, error, fetchUserSettings, saveUserSettings } =
    useUserSettings();

  useEffect(() => {
    fetchUserSettings();
  }, []);

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
    });
  }

  if (loading && !settings) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={200}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!settings) {
    return null;
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
      </Paper>
    </Box>
  );
}
