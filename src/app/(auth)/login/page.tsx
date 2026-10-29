'use client';

import type { FormEvent } from 'react';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Link as MuiLink, Stack, TextField, Typography } from '@mui/material';
import { AuthCard } from '@yaniv120892/my-ui';
import { useT } from '@/i18n/useT';
import { login } from '@/services/authClient';
import { authErrorMessage } from '@/utils/authErrorMessage';

function LoginForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get('reason') === 'session-expired';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(authErrorMessage({ error: err, fallback: t('auth.login.failed'), t }));
      setSubmitting(false);
    }
  }

  return (
    <AuthCard app="expenses" title={t('auth.login.title')}>
      <Stack component="form" onSubmit={handleSubmit} spacing={2.5}>
        {sessionExpired && !error && (
          <Alert severity="info">{t('auth.login.sessionExpired')}</Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}
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
        <TextField
          label={t('auth.password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          fullWidth
        />
        <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
          {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          {t('auth.login.noAccount')}{' '}
          <MuiLink component={Link} href="/signup">
            {t('auth.login.signupLink')}
          </MuiLink>
        </Typography>
      </Stack>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
