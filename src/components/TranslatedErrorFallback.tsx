'use client';

import ErrorFallback from '@/components/ErrorFallback';
import { useT } from '@/i18n/useT';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  minHeight: string;
};

export default function TranslatedErrorFallback({ error, reset, minHeight }: Props) {
  const t = useT();
  return (
    <ErrorFallback
      error={error}
      reset={reset}
      minHeight={minHeight}
      labels={{
        title: t('common.errorTitle'),
        unexpectedError: t('common.unexpectedError'),
        retry: t('common.retry'),
      }}
    />
  );
}
