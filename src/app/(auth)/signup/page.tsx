'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Alert,
  Button,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { signup } from '@/services/authClient';

export default function SignupPage() {
  const router = useRouter();
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
      router.push(`/verify?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
      setSubmitting(false);
    }
  }

  return (
    <Stack component="form" onSubmit={handleSubmit} spacing={2.5}>
      <Typography variant="h3" component="h2">
        Create your account
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        autoFocus
        fullWidth
      />
      <TextField
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
        slotProps={{ htmlInput: { minLength: 8 } }}
        helperText="At least 8 characters"
        fullWidth
      />
      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={submitting}
        fullWidth
      >
        {submitting ? 'Creating account…' : 'Sign up'}
      </Button>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        Already have an account?{' '}
        <MuiLink component={Link} href="/login">
          Log in
        </MuiLink>
      </Typography>
    </Stack>
  );
}
