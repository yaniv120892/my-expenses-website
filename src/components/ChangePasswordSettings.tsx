'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { Alert, Button, Stack, TextField } from '@mui/material';
import { useT } from '@/i18n/useT';
import { changePassword } from '@/services/authClient';
import { authErrorMessage } from '@/utils/authErrorMessage';
import { PASSWORD_MIN_LENGTH } from '@/shared/schemas/auth';

type Outcome = { severity: 'success' | 'error'; message: string };

export default function ChangePasswordSettings() {
  const t = useT();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setOutcome(null);
    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setOutcome({ severity: 'success', message: t('settings.password.changed') });
    } catch (err) {
      setOutcome({
        severity: 'error',
        message: authErrorMessage({ error: err, fallback: t('settings.password.failed'), t }),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ maxWidth: 360 }}>
      {outcome && <Alert severity={outcome.severity}>{outcome.message}</Alert>}
      <TextField
        label={t('settings.password.current')}
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
      <TextField
        label={t('settings.password.new')}
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        autoComplete="new-password"
        slotProps={{ htmlInput: { minLength: PASSWORD_MIN_LENGTH } }}
        helperText={t('settings.password.newHint')}
      />
      <Button type="submit" variant="outlined" disabled={submitting} sx={{ alignSelf: 'start' }}>
        {submitting ? t('settings.password.submitting') : t('settings.password.submit')}
      </Button>
    </Stack>
  );
}
