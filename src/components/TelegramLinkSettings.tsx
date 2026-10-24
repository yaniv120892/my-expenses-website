'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
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

const COPY_LABELS = {
  idle: 'Copy',
  copied: 'Copied',
  failed: 'Copy failed — select the text and copy it by hand',
};

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
  const [issuedCode, setIssuedCode] = useState<IssuedCode | null>(null);
  const createCodeMutation = useCreateTelegramLinkCodeMutation();
  const unlinkMutation = useUnlinkTelegramMutation();
  const testMutation = useTestTelegramMutation();

  // A first link shows up as `linked` turning true; a relink replaces a chat
  // that was already linked, so it has no such signal and waits for "Done".
  const linkedByThisCode =
    issuedCode !== null && !issuedCode.issuedWhileLinked && linked;
  const awaitingLink =
    issuedCode !== null &&
    !issuedCode.issuedWhileLinked &&
    !issuedCode.expired &&
    !linked;
  useUserSettingsQuery({ awaitingTelegramLink: awaitingLink });
  const visibleCode = linkedByThisCode ? null : issuedCode;

  const issuedCodeLifetimeMs = issuedCode
    ? issuedCode.expiresInSeconds * 1000
    : null;
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
      onSuccess: (code) =>
        setIssuedCode({ ...code, issuedWhileLinked: linked, expired: false }),
      onError: (error) =>
        onResult({
          success: false,
          message: describeApiError(error, 'Failed to create a link code'),
        }),
    });
  };

  const handleUnlink = () => {
    unlinkMutation.mutate(undefined, {
      onSuccess: () => {
        setIssuedCode(null);
        onResult({ success: true, message: 'Telegram unlinked' });
      },
      onError: (error) =>
        onResult({
          success: false,
          message: describeApiError(error, 'Failed to unlink Telegram'),
        }),
    });
  };

  const handleTest = async () => {
    const result = await testMutation.mutateAsync();
    onResult({
      success: result.success,
      message: result.success
        ? 'Test message sent successfully'
        : result.message,
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
            label="Linked"
            color="success"
            variant="outlined"
          />
        ) : (
          <Chip label="Not linked" variant="outlined" />
        )}
        {linked && (
          <Button
            variant="outlined"
            size="small"
            onClick={handleTest}
            disabled={testMutation.isPending}
            startIcon={
              testMutation.isPending ? (
                <CircularProgress size={16} color="inherit" />
              ) : null
            }
          >
            Test
          </Button>
        )}
        <Button
          variant={linked ? 'text' : 'contained'}
          size="small"
          onClick={handleCreateCode}
          disabled={createCodeMutation.isPending}
        >
          {linked ? 'Link a different chat' : 'Link Telegram'}
        </Button>
        {linked && (
          <Button
            color="error"
            size="small"
            onClick={handleUnlink}
            disabled={unlinkMutation.isPending}
          >
            Unlink
          </Button>
        )}
      </Stack>

      {visibleCode && (
        <Alert
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => setIssuedCode(null)}
            >
              Done
            </Button>
          }
        >
          {visibleCode.expired ? (
            <Typography variant="body2">
              This code has expired. Create a new one to link a chat.
            </Typography>
          ) : (
            <Stack spacing={1}>
              <Typography variant="body2">
                Send this message to the My Expenses bot from the chat that
                should receive notifications. The code works once and expires in{' '}
                {Math.round(visibleCode.expiresInSeconds / 60)} minutes.
              </Typography>
              <CopyableText
                label="Telegram link command"
                value={visibleCode.command}
                copyLabels={COPY_LABELS}
              />
              {visibleCode.deepLink && (
                <Button
                  variant="outlined"
                  size="small"
                  href={visibleCode.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Open in Telegram
                </Button>
              )}
              {awaitingLink && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Waiting for the bot to receive it…
                </Typography>
              )}
            </Stack>
          )}
        </Alert>
      )}
    </Stack>
  );
}
