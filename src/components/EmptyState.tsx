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
        spacing={1.5}
        sx={{
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
          textAlign: 'center',
          px: 2,
        }}
      >
        {icon || (
          <InfoOutlinedIcon sx={{ fontSize: 44, color: 'text.secondary' }} />
        )}
        <Typography
          sx={{
            color: 'text.secondary',
            fontWeight: 500,
          }}
        >
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
