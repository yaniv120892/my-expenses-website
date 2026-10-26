'use client';

import TranslatedErrorFallback from '@/components/TranslatedErrorFallback';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <TranslatedErrorFallback error={error} reset={reset} minHeight="60vh" />
  );
}
