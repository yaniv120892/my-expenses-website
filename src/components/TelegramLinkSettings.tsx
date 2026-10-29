'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import {
  useCreateTelegramLinkCodeMutation,
  useTestTelegramMutation,
  useUnlinkTelegramMutation,
  useUserSettingsQuery,
} from '@/hooks/useUserSettingsQuery';
import type { TelegramLinkCode } from '@/types';
import { describeApiError } from '@/utils/api';
import CopyableText from '@/components/CopyableText';
import { useT } from '@/i18n/useT';

type IssuedCode = TelegramLinkCode & {
  issuedWhileLinked: boolean;
  expired: boolean;
};

type ActionResult = { success: boolean; message: string };

// Reports through `onResult` and never rejects: the page owns the snackbar.
export default function TelegramLinkSettings({
  linked,
  onResult,
}: {
  linked: boolean;
  onResult: (result: ActionResult) => void;
}) {
  const t = useT();
  const [issuedCode, setIssuedCode] = useState<IssuedCode | null>(null);
  const createCodeMutation = useCreateTelegramLinkCodeMutation();
  const unlinkMutation = useUnlinkTelegramMutation();
  const testMutation = useTestTelegramMutation();

  // A first link shows up as `linked` turning true; a relink replaces a chat
  // that was already linked, so it has no such signal and waits for "Done".
  const linkedByThisCode = issuedCode !== null && !issuedCode.issuedWhileLinked && linked;
  const awaitingLink =
    issuedCode !== null && !issuedCode.issuedWhileLinked && !issuedCode.expired && !linked;
  useUserSettingsQuery({ awaitingTelegramLink: awaitingLink });
  const visibleCode = linkedByThisCode ? null : issuedCode;

  const issuedCodeLifetimeMs = issuedCode ? issuedCode.expiresInSeconds * 1000 : null;
  useEffect(() => {
    if (issuedCodeLifetimeMs === null) {
      return;
    }
    const timer = setTimeout(
      () => setIssuedCode((code) => code && { ...code, expired: true }),
      issuedCodeLifetimeMs,
    );
    return () => clearTimeout(timer);
  }, [issuedCode?.code, issuedCodeLifetimeMs]);

  const handleCreateCode = () => {
    createCodeMutation.mutate(undefined, {
      onSuccess: (code) => setIssuedCode({ ...code, issuedWhileLinked: linked, expired: false }),
      onError: (error) =>
        onResult({
          success: false,
          message: describeApiError(error, t('settings.telegram.createCodeFailed')),
        }),
    });
  };

  const handleUnlink = () => {
    unlinkMutation.mutate(undefined, {
      onSuccess: () => {
        setIssuedCode(null);
        onResult({ success: true, message: t('settings.telegram.unlinked') });
      },
      onError: (error) =>
        onResult({
          success: false,
          message: describeApiError(error, t('settings.telegram.unlinkFailed')),
        }),
    });
  };

  const handleTest = async () => {
    const result = await testMutation.mutateAsync();
    onResult({
      success: result.success,
      message: result.success ? t('settings.telegram.testSent') : result.message,
    });
  };

  return (
    <Stack spacing={1.5}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
      >
        {linked ? (
          <Chip
            icon={<CheckCircleOutlinedIcon />}
            label={t('settings.telegram.linked')}
            color="success"
            variant="outlined"
          />
        ) : (
          <Chip label={t('settings.telegram.notLinked')} variant="outlined" />
        )}
        {linked && (
          <Button
            variant="outlined"
            size="small"
            onClick={handleTest}
            disabled={testMutation.isPending}
            startIcon={
              testMutation.isPending ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {t('settings.telegram.test')}
          </Button>
        )}
        <Button
          variant={linked ? 'text' : 'contained'}
          size="small"
          onClick={handleCreateCode}
          disabled={createCodeMutation.isPending}
        >
          {linked ? t('settings.telegram.relink') : t('settings.telegram.link')}
        </Button>
        {linked && (
          <Button
            color="error"
            size="small"
            onClick={handleUnlink}
            disabled={unlinkMutation.isPending}
          >
            {t('settings.telegram.unlink')}
          </Button>
        )}
      </Stack>

      {visibleCode && (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" onClick={() => setIssuedCode(null)}>
              {t('settings.telegram.done')}
            </Button>
          }
        >
          {visibleCode.expired ? (
            <Typography variant="body2">{t('settings.telegram.codeExpired')}</Typography>
          ) : (
            <Stack spacing={1}>
              <Typography variant="body2">
                {t('settings.telegram.instructions', {
                  minutes: Math.round(visibleCode.expiresInSeconds / 60),
                })}
              </Typography>
              <CopyableText label={t('settings.telegram.command')} value={visibleCode.command} />
              {visibleCode.deepLink && (
                <Button
                  variant="outlined"
                  size="small"
                  href={visibleCode.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {t('settings.telegram.open')}
                </Button>
              )}
              {awaitingLink && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t('settings.telegram.waiting')}
                </Typography>
              )}
            </Stack>
          )}
        </Alert>
      )}
    </Stack>
  );
}
