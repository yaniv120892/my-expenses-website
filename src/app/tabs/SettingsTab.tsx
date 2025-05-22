"use client";
import React, { useEffect, useState, useRef } from "react";
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
  CircularProgress,
  Snackbar,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useUserSettings } from "@/hooks/useUserSettings";
import SettingsTabSkeleton from "@/components/SettingsTabSkeleton";
import { useForm, Controller } from "react-hook-form";
import { useIsMobile } from "@/hooks/useIsMobile";

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
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testSnackbarOpen, setTestSnackbarOpen] = useState(false);
  const testResultTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { control, handleSubmit, reset, watch, formState } = useForm({
    defaultValues: {
      provider: { telegramChatId: "" },
      notifications: { createTransaction: false, dailySummary: false },
      info: { email: "" },
    },
    mode: "onChange",
  });

  const isMobile = useIsMobile();
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipAnchorRef = useRef<HTMLButtonElement | null>(null);

  function handleTooltipClose() {
    setTooltipOpen(false);
  }

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
    setTestSnackbarOpen(true);
  };

  useEffect(() => {
    if (testResult) {
      if (testResultTimeoutRef.current) {
        clearTimeout(testResultTimeoutRef.current);
      }
      testResultTimeoutRef.current = setTimeout(() => {
        setTestResult("");
        setTestSnackbarOpen(false);
      }, 5000);
    }
    return () => {
      if (testResultTimeoutRef.current) {
        clearTimeout(testResultTimeoutRef.current);
      }
    };
  }, [testResult]);

  const onSave = async (data: UserSettingsForm) => {
    setSaveLoading(true);
    await saveUserSettings({
      ...data,
      provider: {
        enabled: data.provider.telegramChatId ? true : false,
        telegramChatId: data.provider.telegramChatId,
      },
    });
    reset({
      provider: {
        telegramChatId: data.provider.telegramChatId,
      },
      notifications: {
        createTransaction: data.notifications.createTransaction,
        dailySummary: data.notifications.dailySummary,
      },
      info: {
        email: data.info.email,
      },
    });
    setSaveLoading(false);
    setSaveSuccess(true);
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
    <Box maxWidth={600} mx="auto" mt={4}>
      <Paper
        elevation={3}
        sx={{ p: 3, mb: 4, backgroundColor: "var(--secondary)" }}
      >
        <Typography variant="h6" gutterBottom color="var(--primary)">
          Info
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box display="flex" flexDirection="column" gap={1}>
          <Box
            display="flex"
            flexDirection={isMobile ? "column" : "row"}
            alignItems={isMobile ? undefined : "center"}
            gap={2}
          >
            <Box
              minWidth={120}
              display="flex"
              alignItems={isMobile ? undefined : "center"}
              mb={isMobile ? 0.5 : 0}
            >
              <Typography
                variant="body1"
                color="var(--primary)"
                fontWeight="bold"
                sx={{ mr: 0 }}
              >
                Email:
              </Typography>
            </Box>
            <Box
              flex={1}
              display="flex"
              alignItems={isMobile ? undefined : "center"}
              sx={{ ml: 0 }}
            >
              <Controller
                name="info.email"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    error={!!formState.errors.info?.email}
                    helperText={formState.errors.info?.email?.message || ""}
                    size="small"
                    sx={{ width: 300 }}
                    disabled
                  />
                )}
              />
            </Box>
            {!isMobile && <Box width={120} />}
          </Box>
          <Box height={isMobile ? 8 : 16} />
          <Box
            display="flex"
            flexDirection={isMobile ? "column" : "row"}
            alignItems={isMobile ? undefined : "center"}
            gap={2}
          >
            <Box
              minWidth={120}
              display="flex"
              alignItems={isMobile ? undefined : "center"}
              mb={isMobile ? 0.5 : 0}
              gap={1}
            >
              <Typography
                variant="body1"
                color="var(--primary)"
                fontWeight="bold"
              >
                Telegram chat id:
              </Typography>
            </Box>
            <Box flex={1} display="flex" alignItems="center" gap={1}>
              <Controller
                name="provider.telegramChatId"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    error={!!formState.errors.provider?.telegramChatId}
                    helperText={
                      formState.errors.provider?.telegramChatId?.message || ""
                    }
                    size="small"
                    sx={{ width: 300 }}
                  />
                )}
              />
              <Tooltip
                title="To get your chat ID, create a new group on Telegram, add my-expenses-bot to the group, and send a message: @WhatIsMyChatId. The bot will reply with your chat ID. Copy it here."
                open={isMobile ? tooltipOpen : undefined}
                onClose={isMobile ? handleTooltipClose : undefined}
                disableFocusListener={isMobile}
                disableHoverListener={isMobile}
                disableTouchListener={isMobile}
                placement="top"
                arrow
              >
                <IconButton
                  size="small"
                  ref={tooltipAnchorRef}
                  onClick={
                    isMobile
                      ? (e) => {
                          e.stopPropagation();
                          setTooltipOpen((open) => !open);
                        }
                      : undefined
                  }
                  aria-label="Telegram chat id info"
                >
                  <InfoOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Box
              display="flex"
              alignItems="center"
              gap={1}
              mt={isMobile ? 1 : 0}
            >
              <Button
                variant="outlined"
                size="small"
                sx={{
                  backgroundColor: "var(--primary)",
                  color: "var(--secondary)",
                  minWidth: 80,
                  "&.Mui-disabled": {
                    backgroundColor: "var(--primary)",
                    color: "var(--secondary)",
                    opacity: 0.5,
                  },
                }}
                onClick={handleTestTelegram}
                disabled={
                  testLoading ||
                  !watchedValues.provider.telegramChatId ||
                  !!formState.errors.provider?.telegramChatId
                }
                hidden={watchedValues.provider.telegramChatId === ""}
                startIcon={
                  testLoading ? (
                    <Box display="flex" alignItems="center">
                      <CircularProgress size={16} color="inherit" />
                    </Box>
                  ) : null
                }
              >
                Test
              </Button>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 4 }} />
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
        <Box display="flex" justifyContent="center" gap={2}>
          <Button
            variant="contained"
            onClick={handleSubmit(onSave)}
            disabled={
              !isDirty ||
              saveLoading ||
              !!formState.errors.provider?.telegramChatId
            }
            sx={{
              backgroundColor: "var(--primary)",
              color: "var(--secondary)",
              minWidth: 80,
              width: "50%",
            }}
            startIcon={
              saveLoading ? (
                <CircularProgress size={18} color="inherit" />
              ) : null
            }
          >
            {saveLoading ? "Saving..." : "Save"}
          </Button>
        </Box>
      </Paper>
      <Snackbar
        open={saveSuccess}
        autoHideDuration={4000}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="success" sx={{ width: "100%" }}>
          Settings saved successfully
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!testResult && testSnackbarOpen}
        autoHideDuration={4000}
        onClose={() => {
          setTestSnackbarOpen(false);
          setTestResult("");
        }}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={
            testResult === "Test message sent successfully"
              ? "success"
              : "error"
          }
          sx={{ width: "100%" }}
        >
          {testResult}
        </Alert>
      </Snackbar>
    </Box>
  );
}
