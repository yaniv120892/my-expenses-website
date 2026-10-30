'use client';

import type { FormEvent } from 'react';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Link as MuiLink, Stack, TextField, Typography } from '@mui/material';
import { AuthCard } from '@yaniv120892/my-ui';
import { useT } from '@/i18n/useT';
import { signup } from '@/services/authClient';
import { NEXT_PATH_PARAM, safeNextPath, withNextPath } from '@/shared/nextPath';
import { authErrorMessage } from '@/utils/authErrorMessage';

function SignupForm() {
  const t = useT();
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get(NEXT_PATH_PARAM));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(email, password);
      router.push(withNextPath({ path: `/verify?email=${encodeURIComponent(email)}`, next }));
    } catch (err) {
      setError(authErrorMessage({ error: err, fallback: t('auth.signup.failed'), t }));
      setSubmitting(false);
    }
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
          slotProps={{ htmlInput: { minLength: 8 } }}
          helperText={t('auth.signup.passwordHint')}
          fullWidth
        />
        <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
          {submitting ? t('auth.signup.submitting') : t('auth.signup.submit')}
        </Button>
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          {t('auth.signup.haveAccount')}{' '}
          <MuiLink component={Link} href={withNextPath({ path: '/login', next })}>
            {t('auth.signup.loginLink')}
          </MuiLink>
        </Typography>
      </Stack>
    </AuthCard>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
