'use client';

import { useEffect } from 'react';
import { Box, Button, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import * as Sentry from '@sentry/nextjs';

// Errors thrown by the root layout escape src/app/error.tsx, so this boundary
// replaces the whole document and must render its own html/body.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
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
      </body>
    </html>
  );
}
