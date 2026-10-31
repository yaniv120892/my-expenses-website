'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Link as MuiLink, Stack, TextField, Typography } from '@mui/material';
import { AuthCard } from '@yaniv120892/my-ui';
import { useT } from '@/i18n/useT';
import { requestPasswordReset } from '@/services/authClient';
import { authErrorMessage } from '@/utils/authErrorMessage';

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(authErrorMessage({ error: err, fallback: t('auth.forgot.failed'), t }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard app="expenses" title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')}>
      <Stack component="form" onSubmit={handleSubmit} spacing={2.5}>
        {error && <Alert severity="error">{error}</Alert>}
        {sent && <Alert severity="success">{t('auth.forgot.sent')}</Alert>}
        <TextField
          label={t('auth.email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
          fullWidth
        />
        <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
          {submitting ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
        </Button>
        <Typography variant="body2" sx={{ textAlign: 'center' }}>
          <MuiLink component={Link} href="/login">
            {t('auth.forgot.backToLogin')}
          </MuiLink>
        </Typography>
      </Stack>
    </AuthCard>
  );
}
