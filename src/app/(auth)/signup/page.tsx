'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Link as MuiLink, Stack, TextField, Typography } from '@mui/material';
import { AuthCard } from '@yaniv120892/my-ui';
import { useT } from '@/i18n/useT';
import { signup } from '@/services/authClient';
import { authErrorMessage } from '@/utils/authErrorMessage';
import VerifyCodeForm from '@/components/auth/VerifyCodeForm';
import { PASSWORD_MIN_LENGTH } from '@/shared/schemas/auth';

// The password stays in this page until the code is entered: the signup
// request carries none, so a stranger's signup cannot choose it.
export default function SignupPage() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(email);
      setCodeSent(true);
    } catch (err) {
      setError(authErrorMessage({ error: err, fallback: t('auth.signup.failed'), t }));
    } finally {
      setSubmitting(false);
    }
  }

  if (codeSent) {
    return (
      <AuthCard app="expenses" title={t('auth.verify.title')} subtitle={t('auth.verify.subtitle')}>
        <VerifyCodeForm initialEmail={email} chosenPassword={password} />
      </AuthCard>
    );
  }

  return (
    <AuthCard app="expenses" title={t('auth.signup.title')}>
      <Stack component="form" onSubmit={handleSubmit} spacing={2.5}>
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
          autoComplete="new-password"
          slotProps={{ htmlInput: { minLength: PASSWORD_MIN_LENGTH } }}
          helperText={t('auth.signup.passwordHint')}
          fullWidth
        />
        <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
          {submitting ? t('auth.signup.submitting') : t('auth.signup.submit')}
        </Button>
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          {t('auth.signup.haveAccount')}{' '}
          <MuiLink component={Link} href="/login">
            {t('auth.signup.loginLink')}
          </MuiLink>
        </Typography>
      </Stack>
    </AuthCard>
  );
}
