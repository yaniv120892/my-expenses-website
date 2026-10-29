'use client';

import TranslatedErrorFallback from '@/components/TranslatedErrorFallback';

// Inside the (app) layout, so a failing page keeps the AppShell and its navigation.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <TranslatedErrorFallback error={error} reset={reset} minHeight="40vh" />;
}
