'use client';

import ErrorFallback from '@/components/ErrorFallback';

// Both languages at once: this page replaces the root layout, so neither the
// locale it resolved nor the i18n provider is available.
const LABELS = {
  title: 'Something went wrong · משהו השתבש',
  unexpectedError: 'An unexpected error occurred. · אירעה שגיאה לא צפויה.',
  retry: 'Try again · לנסות שוב',
};

// Replaces the whole document, outside the theme and emotion cache —
// deliberately plain, because whatever broke the root layout may break those
// too.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" dir="auto">
      <body>
        <ErrorFallback error={error} reset={reset} minHeight="100vh" labels={LABELS} />
      </body>
    </html>
  );
}
