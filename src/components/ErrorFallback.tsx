'use client';

import { useEffect } from 'react';
import { Box, Button, Typography } from '@mui/material';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import * as Sentry from '@sentry/nextjs';

type ErrorFallbackLabels = {
  title: string;
  unexpectedError: string;
  retry: string;
};

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  minHeight: string;
  labels: ErrorFallbackLabels;
};

/** Takes its text as props: the global error page renders outside the i18n provider. */
export default function ErrorFallback({ error, reset, minHeight, labels }: Props) {
  useEffect(() => {
    // A `digest` means Next redacted a server error that `onRequestError`
    // already reported with its real stack.
    if (error.digest) {
      return;
    }
    Sentry.captureException(error);
  }, [error]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: minHeight,
        gap: 2,
      }}
    >
      <ErrorOutlinedIcon sx={{ fontSize: 64, color: 'error.main' }} />
      <Typography
        variant="h6"
        sx={{
          color: 'text.primary',
        }}
      >
        {labels.title}
      </Typography>
      <Typography
        sx={{
          color: 'text.secondary',
          textAlign: 'center',
          maxWidth: 400,
        }}
      >
        {error.message || labels.unexpectedError}
      </Typography>
      <Button variant="contained" color="primary" onClick={reset}>
        {labels.retry}
      </Button>
    </Box>
  );
}
