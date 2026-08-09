import React from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Button, Fade, Stack, Typography } from '@mui/material';

type Props = {
  message: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({
  message,
  icon,
  actionLabel,
  onAction,
}: Props) {
  return (
    <Fade in>
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={1.5}
        sx={{ minHeight: 200, textAlign: 'center', px: 2 }}
      >
        {icon || (
          <InfoOutlinedIcon sx={{ fontSize: 44, color: 'text.secondary' }} />
        )}
        <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
          {message}
        </Typography>
        {actionLabel && onAction && (
          <Button variant="text" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </Stack>
    </Fade>
  );
}
