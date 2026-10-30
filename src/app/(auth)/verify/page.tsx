'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthCard } from '@yaniv120892/my-ui';
import { useT } from '@/i18n/useT';
import VerifyCodeForm from '@/components/auth/VerifyCodeForm';

function VerifyCard() {
  const t = useT();
  const searchParams = useSearchParams();
  return (
    <AuthCard app="expenses" title={t('auth.verify.title')} subtitle={t('auth.verify.subtitle')}>
      <VerifyCodeForm initialEmail={searchParams.get('email') ?? ''} />
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
