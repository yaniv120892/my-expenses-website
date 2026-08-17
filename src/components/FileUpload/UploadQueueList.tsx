'use client';

import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import {
  isTerminal,
  UploadItem,
  UploadItemStatus,
} from '@/utils/importUploadQueue';

// 'succeeded' is absent by design: that row renders a tick, never a chip.
const STATUS_CHIPS: Record<
  Exclude<UploadItemStatus, 'succeeded'>,
  { label: string; color: 'default' | 'primary' | 'error' }
> = {
  queued: { label: 'Queued', color: 'default' },
  uploading: { label: 'Uploading', color: 'primary' },
  processing: { label: 'Processing', color: 'primary' },
  failed: { label: 'Failed', color: 'error' },
};

function formatSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1) return `${megabytes.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface UploadQueueListProps {
  items: UploadItem[];
  isRunning: boolean;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onPaymentMonthChange: (id: string, paymentMonth: string) => void;
}

export default function UploadQueueList({
  items,
  isRunning,
  onRemove,
  onRetry,
  onPaymentMonthChange,
}: UploadQueueListProps) {
  if (items.length === 0) return null;

  return (
    <Stack spacing={1.5} sx={{ mt: 2 }}>
      {items.map((item) => (
        <Box
          key={item.id}
          sx={{
            p: 1.5,
            border: 1,
            borderColor: item.status === 'failed' ? 'error.main' : 'divider',
            borderRadius: 2,
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="space-between"
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap title={item.file.name}>
                {item.file.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatSize(item.file.size)}
              </Typography>
            </Box>

            <Stack direction="row" spacing={0.5} alignItems="center">
              {item.status === 'succeeded' ? (
                <CheckCircleOutlineRoundedIcon
                  fontSize="small"
                  color="success"
                />
              ) : (
                <Chip
                  size="small"
                  label={STATUS_CHIPS[item.status].label}
                  color={STATUS_CHIPS[item.status].color}
                />
              )}

              {item.status === 'failed' && (
                <Tooltip
                  title={isRunning ? 'Wait for the batch to finish' : 'Retry'}
                >
                  <span>
                    <IconButton
                      size="small"
                      aria-label={`Retry ${item.file.name}`}
                      disabled={isRunning}
                      onClick={() => onRetry(item.id)}
                    >
                      <RefreshRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}

              {(item.status === 'queued' || item.status === 'failed') && (
                <IconButton
                  size="small"
                  aria-label={`Remove ${item.file.name}`}
                  onClick={() => onRemove(item.id)}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          </Stack>

          {!isTerminal(item.status) && (
            <TextField
              fullWidth
              size="small"
              label="Payment Month (MM/YYYY)"
              value={item.paymentMonth}
              onChange={(e) => onPaymentMonthChange(item.id, e.target.value)}
              disabled={item.status !== 'queued'}
              placeholder="Optional"
              sx={{ mt: 1.5 }}
            />
          )}

          {(item.status === 'uploading' || item.status === 'processing') && (
            <LinearProgress
              variant={
                item.status === 'uploading' ? 'determinate' : 'indeterminate'
              }
              value={item.progress}
              sx={{ mt: 1.5, borderRadius: 1 }}
            />
          )}

          {item.status === 'failed' && item.error && (
            <Typography
              variant="caption"
              color="error"
              sx={{ mt: 1 }}
              display="block"
            >
              {item.error}
            </Typography>
          )}
        </Box>
      ))}
    </Stack>
  );
}
