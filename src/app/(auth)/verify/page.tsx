'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { verifyCode } from '@/services/authClient';

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await verifyCode(code, email);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code');
      setSubmitting(false);
    }
  }

  return (
    <Stack component="form" onSubmit={handleSubmit} spacing={2.5}>
      <Typography variant="h3" component="h2">
        Verify your email
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Enter the 6-digit code we sent to your email. It expires in 10 minutes.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        fullWidth
      />
      <TextField
        label="Verification code"
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
      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={submitting}
        fullWidth
      >
        {submitting ? 'Verifying…' : 'Verify'}
      </Button>
    </Stack>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
