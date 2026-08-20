'use client';

import { useEffect } from 'react';
import { Box, Button, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import * as Sentry from '@sentry/nextjs';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  // The root boundary owns the whole viewport; the route boundary sits inside
  // the app shell and only fills the content area.
  minHeight: string;
};

export default function ErrorFallback({ error, reset, minHeight }: Props) {
  useEffect(() => {
    // A `digest` means Next redacted a server-side error before re-rendering
    // this boundary on the client. `onRequestError` already reported that one
    // with its real stack, so reporting the redacted copy would spend a second
    // event on a message that carries no stack to act on.
    if (error.digest) {
      return;
    }
    Sentry.captureException(error);
  }, [error]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight={minHeight}
      gap={2}
    >
      <ErrorOutlineIcon sx={{ fontSize: 64, color: 'error.main' }} />
      <Typography variant="h6" color="text.primary">
        Something went wrong
      </Typography>
      <Typography color="text.secondary" textAlign="center" maxWidth={400}>
        {error.message || 'An unexpected error occurred.'}
      </Typography>
      <Button variant="contained" color="primary" onClick={reset}>
        Try Again
      </Button>
    </Box>
  );
}
