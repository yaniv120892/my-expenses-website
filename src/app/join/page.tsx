'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { AuthCard } from '@yaniv120892/my-ui';
import { useInvitePreviewQuery, useJoinHouseholdMutation } from '@/hooks/useHouseholdQuery';
import { useT } from '@/i18n/useT';
import { INVITE_CODE_PARAM, type InvitePreview } from '@/shared/types/household';
import { describeHouseholdError } from '@/utils/householdError';

function JoinHousehold() {
  const t = useT();
  const code = useSearchParams().get(INVITE_CODE_PARAM)?.trim() ?? '';
  const preview = useInvitePreviewQuery(code);

  if (code === '') {
    return (
      <Stack spacing={2.5}>
        <Alert severity="error">{t('join.missingCode')}</Alert>
        <DashboardLink />
      </Stack>
    );
  }
  if (preview.isLoading) {
    return (
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <CircularProgress size={20} />
        <Typography>{t('join.checking')}</Typography>
      </Stack>
    );
  }
  if (preview.error || !preview.data) {
    return (
      <Stack spacing={2.5}>
        <Alert severity="error">
          {describeHouseholdError({ error: preview.error, fallback: t('join.invalid'), t })}
        </Alert>
        <DashboardLink />
      </Stack>
    );
  }
  return <JoinOffer invite={preview.data} />;
}

function JoinOffer({ invite }: { invite: InvitePreview }) {
  const t = useT();
  const router = useRouter();
  const joinMutation = useJoinHouseholdMutation();

  function join() {
    joinMutation.mutate(invite.code, {
      onSuccess: () => {
        router.push('/dashboard');
        router.refresh();
      },
    });
  }

  switch (invite.eligibility) {
    case 'already-member':
      return (
        <Stack spacing={2.5}>
          <Alert severity="info">{t('join.alreadyMember', { owner: invite.ownerName })}</Alert>
          <DashboardLink />
        </Stack>
      );
    case 'household-in-use':
      return (
        <Stack spacing={2.5}>
          <Alert severity="warning">{t('join.householdInUse')}</Alert>
          <DashboardLink />
        </Stack>
      );
    case 'can-join':
      return (
        <Stack spacing={2.5}>
          <Typography>
            {t('join.offer', {
              owner: invite.ownerName,
              role: t(`household.role.${invite.role}`),
            })}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t(`household.roleHint.${invite.role}`)}
          </Typography>
          {joinMutation.error && (
            <Alert severity="error">
              {describeHouseholdError({ error: joinMutation.error, fallback: t('join.failed'), t })}
            </Alert>
          )}
          <Button
            variant="contained"
            size="large"
            onClick={join}
            disabled={joinMutation.isPending}
            fullWidth
          >
            {joinMutation.isPending ? t('join.submitting') : t('join.submit')}
          </Button>
        </Stack>
      );
    default:
      throw new Error(`Unhandled join eligibility: ${invite.eligibility satisfies never}`);
  }
}

function DashboardLink() {
  const t = useT();
  return (
    <Button component={Link} href="/dashboard" variant="outlined" fullWidth>
      {t('join.toDashboard')}
    </Button>
  );
}

export default function JoinPage() {
  const t = useT();
  return (
    <AuthCard app="expenses" title={t('join.title')}>
      <Suspense>
        <JoinHousehold />
      </Suspense>
    </AuthCard>
  );
}
