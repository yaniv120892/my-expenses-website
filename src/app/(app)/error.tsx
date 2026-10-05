'use client';

import ErrorFallback from '@/components/ErrorFallback';

// Inside the (app) layout, so a failing page keeps the AppShell and its navigation.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} minHeight="40vh" />;
}
