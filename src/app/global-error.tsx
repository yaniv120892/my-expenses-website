'use client';

import ErrorFallback from '@/components/ErrorFallback';

// Errors thrown by the root layout escape src/app/error.tsx, so this boundary
// replaces the whole document and must render its own html/body. It also
// renders outside the theme provider, so it gets MUI's default palette.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorFallback error={error} reset={reset} minHeight="100vh" />
      </body>
    </html>
  );
}
