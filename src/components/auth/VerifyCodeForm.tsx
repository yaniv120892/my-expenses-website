'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Stack, TextField } from '@mui/material';
import { useT } from '@/i18n/useT';
import { verifyCode } from '@/services/authClient';
import { authErrorMessage } from '@/utils/authErrorMessage';
import { PASSWORD_MIN_LENGTH } from '@/shared/schemas/auth';

// The password goes with the code, never with the signup: only whoever reads
// the mailed code may choose it. `chosenPassword` is the one the signup form
// just took, so that path does not ask twice; arriving from the mailed link,
// the form asks for it.
export default function VerifyCodeForm({
  initialEmail,
  chosenPassword,
}: {
  initialEmail: string;
  chosenPassword?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await verifyCode({ code, email, password: chosenPassword ?? password });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(authErrorMessage({ error: err, fallback: t('auth.verify.failed'), t }));
      setSubmitting(false);
    }
  }

  return (
    <Stack component="form" onSubmit={handleSubmit} spacing={2.5}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        label={t('auth.email')}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        fullWidth
      />
      <TextField
        label={t('auth.verify.code')}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        autoFocus
        slotProps={{
          htmlInput: {
            inputMode: 'numeric',
            pattern: '[0-9]*',
            maxLength: 6,
          },
        }}
        fullWidth
      />
      {chosenPassword === undefined && (
        <TextField
          label={t('auth.verify.password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          slotProps={{ htmlInput: { minLength: PASSWORD_MIN_LENGTH } }}
          helperText={t('auth.verify.passwordHint')}
          fullWidth
        />
      )}
      <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
        {submitting ? t('auth.verify.submitting') : t('auth.verify.submit')}
      </Button>
    </Stack>
  );
}
