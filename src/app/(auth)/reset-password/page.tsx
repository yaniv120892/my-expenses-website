'use client';

import type { FormEvent } from 'react';
import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Link as MuiLink, Stack, TextField, Typography } from '@mui/material';
import { AuthCard } from '@yaniv120892/my-ui';
import { useT } from '@/i18n/useT';
import { resetPassword } from '@/services/authClient';
import { authErrorMessage } from '@/utils/authErrorMessage';
import { PASSWORD_MIN_LENGTH } from '@/shared/schemas/auth';
import { readResetToken } from '@/utils/resetToken';

function subscribeToHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

// The emailed link carries the token in its fragment, which only the browser
// sees, so it is read on the client.
function useResetToken(): string | null {
  return useSyncExternalStore(
    subscribeToHash,
    () => readResetToken(window.location.hash),
    () => null,
  );
}

export default function ResetPasswordPage() {
  const t = useT();
  const router = useRouter();
  const token = useResetToken();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword({ token, password });
      router.push('/login?reason=password-reset');
    } catch (err) {
      setError(authErrorMessage({ error: err, fallback: t('auth.reset.failed'), t }));
      setSubmitting(false);
    }
  }

  return (
    <AuthCard app="expenses" title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')}>
      <Stack component="form" onSubmit={handleSubmit} spacing={2.5}>
        {!token && <Alert severity="warning">{t('auth.reset.missingToken')}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label={t('auth.reset.password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          autoComplete="new-password"
          slotProps={{ htmlInput: { minLength: PASSWORD_MIN_LENGTH } }}
          helperText={t('auth.signup.passwordHint')}
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={submitting || !token}
          fullWidth
        >
          {submitting ? t('auth.reset.submitting') : t('auth.reset.submit')}
        </Button>
        <Typography variant="body2" sx={{ textAlign: 'center' }}>
          <MuiLink component={Link} href="/forgot-password">
            {t('auth.reset.requestNew')}
          </MuiLink>
        </Typography>
      </Stack>
    </AuthCard>
  );
}
