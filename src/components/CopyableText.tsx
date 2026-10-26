'use client';

import { useState } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useT } from '@/i18n/useT';

type CopyState = 'idle' | 'copied' | 'failed';

const COPY_STATE_KEYS = {
  idle: 'common.copy',
  copied: 'common.copied',
  failed: 'common.copyFailed',
} as const satisfies Record<CopyState, string>;

/** Code-like values (tokens, URLs, commands) stay left-to-right in either language. */
export default function CopyableText({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const t = useT();
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        p: 1,
        borderRadius: 1,
        bgcolor: 'action.hover',
      }}
    >
      <Typography
        variant="body2"
        component={multiline ? 'pre' : 'span'}
        dir="ltr"
        aria-label={label}
        sx={{
          flexGrow: 1,
          m: 0,
          fontFamily: 'monospace',
          wordBreak: 'break-all',
          whiteSpace: multiline ? 'pre-wrap' : 'normal',
        }}
      >
        {value}
      </Typography>
      <Tooltip title={t(COPY_STATE_KEYS[copyState])}>
        <IconButton
          size="small"
          onClick={handleCopy}
          aria-label={t('settings.copyLabel', { label })}
        >
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
