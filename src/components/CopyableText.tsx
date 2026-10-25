'use client';

import { useState } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

type CopyLabels = { idle: string; copied: string; failed: string };

type CopyState = keyof CopyLabels;

export default function CopyableText({
  label,
  value,
  copyLabels,
  multiline = false,
}: {
  label: string;
  value: string;
  copyLabels: CopyLabels;
  multiline?: boolean;
}) {
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
      dir="ltr"
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
      <Tooltip title={copyLabels[copyState]}>
        <IconButton
          size="small"
          onClick={handleCopy}
          aria-label={`Copy ${label}`}
        >
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
