'use client';

import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { COPY_STATE_KEYS, useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useT } from '@/i18n/useT';

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
  const { copyState, copy } = useCopyToClipboard(value);

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
        <IconButton size="small" onClick={copy} aria-label={t('settings.copyLabel', { label })}>
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
