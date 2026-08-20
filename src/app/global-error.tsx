'use client';

import ErrorFallback from '@/components/ErrorFallback';

// Errors thrown by the root layout escape src/app/error.tsx, so this boundary
// replaces the whole document and must render its own html/body. That also
// puts it outside the theme and outside AppRouterCacheProvider, so it renders
// with MUI's default palette and no server-side emotion styles — deliberately
// plain, because whatever broke the layout may break those too.
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
