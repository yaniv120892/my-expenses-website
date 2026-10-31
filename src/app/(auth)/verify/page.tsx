'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthCard } from '@yaniv120892/my-ui';
import { useT } from '@/i18n/useT';
import VerifyCodeForm from '@/components/auth/VerifyCodeForm';
import { NEXT_PATH_PARAM, safeNextPath } from '@/shared/nextPath';

function VerifyCard() {
  const t = useT();
  const searchParams = useSearchParams();
  return (
    <AuthCard app="expenses" title={t('auth.verify.title')} subtitle={t('auth.verify.subtitle')}>
      <VerifyCodeForm
        initialEmail={searchParams.get('email') ?? ''}
        next={safeNextPath(searchParams.get(NEXT_PATH_PARAM))}
      />
    </AuthCard>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyCard />
    </Suspense>
  );
}
