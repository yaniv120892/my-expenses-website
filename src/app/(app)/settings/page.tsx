'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Skeleton,
  Snackbar,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useColorScheme,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import { useForm, Controller } from 'react-hook-form';
import PageHeader from '@/components/shell/PageHeader';
import {
  useTestTelegramMutation,
  useUpdateUserSettingsMutation,
  useUserSettingsQuery,
} from '@/hooks/useUserSettingsQuery';

type UserSettingsForm = {
  provider: {
    telegramChatId: string;
  };
  notifications: {
    createTransaction: boolean;
    dailySummary: boolean;
    subscriptionAudit: boolean;
  };
  info: {
    email: string;
  };
};

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h4" sx={{ mb: 2 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function AppearanceSection() {
  const { mode, setMode } = useColorScheme();
  const [mounted, setMounted] = useState(false);

  // useColorScheme returns undefined mode before hydration; rendering the
  // group only after mount avoids an uncontrolled-to-controlled flip.
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SettingsSection title="Appearance">
      {mounted ? (
        <ToggleButtonGroup
          value={mode ?? 'system'}
          exclusive
          onChange={(_, value) => {
            if (value) setMode(value);
          }}
          size="small"
          aria-label="Theme mode"
        >
          <ToggleButton value="light">
            <LightModeOutlinedIcon sx={{ mr: 0.75 }} fontSize="small" />
            Light
          </ToggleButton>
          <ToggleButton value="system">
            <SettingsBrightnessOutlinedIcon sx={{ mr: 0.75 }} fontSize="small" />
            System
          </ToggleButton>
          <ToggleButton value="dark">
            <DarkModeOutlinedIcon sx={{ mr: 0.75 }} fontSize="small" />
            Dark
          </ToggleButton>
        </ToggleButtonGroup>
      ) : (
        <Skeleton variant="rounded" width={280} height={36} />
      )}
    </SettingsSection>
  );
}

function SettingsSkeleton() {
  return (
    <Stack spacing={2}>
      {[1, 2, 3].map((i) => (
        <Card variant="outlined" key={i}>
          <CardContent>
            <Skeleton variant="text" width={140} height={28} sx={{ mb: 2 }} />
            <Skeleton variant="rounded" height={40} sx={{ mb: 1.5 }} />
            <Skeleton variant="rounded" height={40} width="60%" />
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

export default function SettingsPage() {
  const { data: settings, isLoading: loading, error } = useUserSettingsQuery();
  const { mutateAsync: saveUserSettings } = useUpdateUserSettingsMutation();
  const { mutateAsync: testTelegramConnection } = useTestTelegramMutation();

  const [testResult, setTestResult] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testSnackbarOpen, setTestSnackbarOpen] = useState(false);
  const testResultTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { control, handleSubmit, reset, watch, formState } = useForm({
    defaultValues: {
      provider: { telegramChatId: '' },
      notifications: {
        createTransaction: false,
        dailySummary: false,
        subscriptionAudit: false,
      },
      info: { email: '' },
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (settings) {
      reset({
        provider: {
          ...settings.provider,
          telegramChatId: settings.provider.telegramChatId || '',
        },
        notifications: { ...settings.notifications },
        info: { ...settings.info },
      });
    }
  }, [settings, reset]);

  const watchedValues = watch();
  const isDirty = formState.isDirty;

  const handleTestTelegram = async () => {
    setTestResult('');
    setTestLoading(true);
    try {
      const result = await testTelegramConnection(
        watchedValues.provider.telegramChatId,
      );
      setTestResult(
        result.success ? 'Test message sent successfully' : result.message,
      );
    } catch {
      setTestResult('Failed to send test message');
    } finally {
      setTestLoading(false);
      setTestSnackbarOpen(true);
    }
  };

  useEffect(() => {
    if (testResult) {
      if (testResultTimeoutRef.current) {
        clearTimeout(testResultTimeoutRef.current);
      }
      testResultTimeoutRef.current = setTimeout(() => {
        setTestResult('');
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
        subscriptionAudit: data.notifications.subscriptionAudit,
      },
      info: {
        email: data.info.email,
      },
    });
    setSaveLoading(false);
    setSaveSuccess(true);
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Settings" />
        <SettingsSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Settings" />
        <Alert severity="error">
          {error instanceof Error ? error.message : String(error)}
        </Alert>
      </>
    );
  }

  if (!settings) {
    return (
      <>
        <PageHeader title="Settings" />
        <Alert severity="error">Failed to load settings</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        action={
          <Button
            variant="contained"
            onClick={handleSubmit(onSave)}
            disabled={
              !isDirty ||
              saveLoading ||
              !!formState.errors.provider?.telegramChatId
            }
            startIcon={
              saveLoading ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {saveLoading ? 'Saving...' : 'Save'}
          </Button>
        }
      />

      <Stack spacing={2} sx={{ maxWidth: 720 }}>
        <AppearanceSection />

        <SettingsSection title="Account">
          <Stack spacing={2}>
            <Controller
              name="info.email"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Email"
                  error={!!formState.errors.info?.email}
                  helperText={formState.errors.info?.email?.message || ''}
                  disabled
                  sx={{ maxWidth: 360 }}
                />
              )}
            />
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', sm: 'center' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                <Controller
                  name="provider.telegramChatId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Telegram chat id"
                      error={!!formState.errors.provider?.telegramChatId}
                      helperText={
                        formState.errors.provider?.telegramChatId?.message || ''
                      }
                      sx={{ maxWidth: 360, flex: 1 }}
                    />
                  )}
                />
                <Tooltip
                  title="Used to send notifications to your Telegram account. Instructions on finding this id are coming soon - meanwhile you can ask ChatGPT."
                  placement="top"
                  enterTouchDelay={0}
                >
                  <IconButton size="small" aria-label="Telegram chat id info">
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={handleTestTelegram}
                disabled={
                  testLoading ||
                  !watchedValues.provider.telegramChatId ||
                  !!formState.errors.provider?.telegramChatId
                }
                startIcon={
                  testLoading ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : null
                }
                sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
              >
                Test
              </Button>
            </Stack>
          </Stack>
        </SettingsSection>

        <SettingsSection title="Notifications">
          <Stack>
            <Controller
              name="notifications.createTransaction"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
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
                    />
                  }
                  label="Daily summary notification"
                />
              )}
            />
            <Controller
              name="notifications.subscriptionAudit"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  }
                  label="Monthly subscription audit"
                />
              )}
            />
          </Stack>
        </SettingsSection>
      </Stack>

      <Snackbar
        open={saveSuccess}
        autoHideDuration={4000}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          Settings saved successfully
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!testResult && testSnackbarOpen}
        autoHideDuration={4000}
        onClose={() => {
          setTestSnackbarOpen(false);
          setTestResult('');
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={
            testResult === 'Test message sent successfully'
              ? 'success'
              : 'error'
          }
          sx={{ width: '100%' }}
        >
          {testResult}
        </Alert>
      </Snackbar>
    </>
  );
}
