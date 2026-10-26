'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControlLabel,
  Skeleton,
  Snackbar,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useColorScheme,
} from '@mui/material';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import { useForm, Controller } from 'react-hook-form';
import { PageHeader } from '@yaniv120892/my-ui';
import ApiTokenManager from '@/components/ApiTokenManager';
import PersonalAgentSettings from '@/components/PersonalAgentSettings';
import TelegramLinkSettings from '@/components/TelegramLinkSettings';
import {
  useTestMonthlyReportMutation,
  useUpdateUserSettingsMutation,
  useUserSettingsQuery,
} from '@/hooks/useUserSettingsQuery';
import { describeApiError } from '@/utils/api';
import { useT } from '@/i18n/useT';

type UserSettingsForm = {
  notifications: {
    createTransaction: boolean;
    dailySummary: boolean;
    subscriptionAudit: boolean;
    monthlyReport: boolean;
  };
  info: {
    email: string;
  };
};

const NOTIFICATION_FIELDS = [
  {
    name: 'notifications.createTransaction',
    labelKey: 'settings.notifications.createTransaction',
  },
  {
    name: 'notifications.dailySummary',
    labelKey: 'settings.notifications.dailySummary',
  },
  {
    name: 'notifications.subscriptionAudit',
    labelKey: 'settings.notifications.subscriptionAudit',
  },
  {
    name: 'notifications.monthlyReport',
    labelKey: 'settings.notifications.monthlyReport',
  },
] as const;

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
  const t = useT();
  const { mode, setMode } = useColorScheme();
  const [mounted, setMounted] = useState(false);

  // useColorScheme returns undefined mode before hydration; rendering the
  // group only after mount avoids an uncontrolled-to-controlled flip.
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SettingsSection title={t('settings.appearance.title')}>
      {mounted ? (
        <ToggleButtonGroup
          value={mode ?? 'system'}
          exclusive
          onChange={(_, value) => {
            if (value) {
              setMode(value);
            }
          }}
          size="small"
          aria-label={t('settings.appearance.mode')}
        >
          <ToggleButton value="light">
            <LightModeOutlinedIcon sx={{ mr: 0.75 }} fontSize="small" />
            {t('settings.appearance.light')}
          </ToggleButton>
          <ToggleButton value="system">
            <SettingsBrightnessOutlinedIcon
              sx={{ mr: 0.75 }}
              fontSize="small"
            />
            {t('settings.appearance.system')}
          </ToggleButton>
          <ToggleButton value="dark">
            <DarkModeOutlinedIcon sx={{ mr: 0.75 }} fontSize="small" />
            {t('settings.appearance.dark')}
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
  const t = useT();
  const { data: settings, isLoading: loading, error } = useUserSettingsQuery();
  const { mutateAsync: saveUserSettings } = useUpdateUserSettingsMutation();
  const { mutateAsync: sendTestMonthlyReport } = useTestMonthlyReportMutation();

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [reportTestLoading, setReportTestLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { control, handleSubmit, reset, watch, formState } = useForm({
    defaultValues: {
      notifications: {
        createTransaction: false,
        dailySummary: false,
        subscriptionAudit: false,
        monthlyReport: false,
      },
      info: { email: '' },
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (settings) {
      reset(
        {
          notifications: { ...settings.notifications },
          info: { ...settings.info },
        },
        // A refetch the user did not ask for (the Telegram link poll) must
        // not discard toggles they have not saved yet.
        { keepDirtyValues: true },
      );
    }
  }, [settings, reset]);

  const watchedValues = watch();
  const isDirty = formState.isDirty;

  const handleTestMonthlyReport = async () => {
    setTestResult(null);
    setReportTestLoading(true);
    try {
      setTestResult(await sendTestMonthlyReport());
    } catch {
      setTestResult({
        success: false,
        message: t('settings.notifications.testReportFailed'),
      });
    } finally {
      setReportTestLoading(false);
    }
  };

  const onSave = async (data: UserSettingsForm) => {
    setSaveLoading(true);
    try {
      await saveUserSettings(data);
      reset(data);
      setSaveSuccess(true);
    } catch (error) {
      setTestResult({
        success: false,
        message: describeApiError(error, t('settings.saveFailed')),
      });
    } finally {
      setSaveLoading(false);
    }
  };

  const header = <PageHeader title={t('settings.title')} />;

  if (loading) {
    return (
      <>
        {header}
        <SettingsSkeleton />
      </>
    );
  }

  if (error && !settings) {
    return (
      <>
        {header}
        <Alert severity="error">
          {error instanceof Error ? error.message : String(error)}
        </Alert>
      </>
    );
  }

  if (!settings) {
    return (
      <>
        {header}
        <Alert severity="error">{t('settings.loadFailed')}</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        actions={
          <Button
            variant="contained"
            onClick={handleSubmit(onSave)}
            disabled={!isDirty || saveLoading}
            startIcon={
              saveLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : null
            }
          >
            {saveLoading ? t('common.saving') : t('common.save')}
          </Button>
        }
      />

      <Stack spacing={2} sx={{ maxWidth: 720 }}>
        <AppearanceSection />

        <SettingsSection title={t('settings.account.title')}>
          <Stack spacing={2}>
            <Controller
              name="info.email"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t('settings.account.email')}
                  error={!!formState.errors.info?.email}
                  helperText={formState.errors.info?.email?.message || ''}
                  disabled
                  sx={{ maxWidth: 360 }}
                />
              )}
            />
          </Stack>
        </SettingsSection>

        <SettingsSection title={t('settings.telegram.title')}>
          <TelegramLinkSettings
            linked={settings.provider.telegramLinked}
            onResult={setTestResult}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.notifications.title')}>
          <Stack>
            {NOTIFICATION_FIELDS.map(({ name, labelKey }) => (
              <Stack
                key={name}
                direction="row"
                spacing={1.5}
                sx={{
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Controller
                  name={name}
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                      }
                      label={t(labelKey)}
                    />
                  )}
                />
                {name === 'notifications.monthlyReport' && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleTestMonthlyReport}
                    disabled={
                      reportTestLoading ||
                      !watchedValues.notifications.monthlyReport
                    }
                    startIcon={
                      reportTestLoading ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : null
                    }
                  >
                    {t('settings.notifications.sendNow')}
                  </Button>
                )}
              </Stack>
            ))}
          </Stack>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              display: 'block',
              mt: 1,
            }}
          >
            {t('settings.notifications.sendNowHint')}
          </Typography>
        </SettingsSection>

        <SettingsSection title={t('settings.agent.title')}>
          <PersonalAgentSettings />
        </SettingsSection>

        <SettingsSection title={t('settings.tokens.title')}>
          <ApiTokenManager />
        </SettingsSection>
      </Stack>

      <Snackbar
        open={saveSuccess}
        autoHideDuration={4000}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          {t('settings.saved')}
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!testResult}
        autoHideDuration={8000}
        onClose={() => setTestResult(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={testResult?.success ? 'success' : 'error'}
          sx={{ width: '100%' }}
        >
          {testResult?.message}
        </Alert>
      </Snackbar>
    </>
  );
}
