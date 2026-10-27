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
  describeUploadError,
  isTerminal,
  UploadItem,
  UploadItemStatus,
} from '@/utils/importUploadQueue';
import { isUnreadablePaymentMonth } from '@/utils/paymentMonth';
import { useT } from '@/i18n/useT';
import type { T } from '@/i18n/useT.types';
import { useAppFormat, type AppFormatter } from '@/i18n/useAppFormat';
import { BYTES_PER_MEGABYTE } from '@/shared/uploadLimits';

// 'succeeded' is absent by design: that row renders a tick, never a chip.
const STATUS_CHIPS = {
  queued: { labelKey: 'imports.upload.queued', color: 'default' },
  uploading: { labelKey: 'imports.upload.uploading', color: 'primary' },
  processing: { labelKey: 'imports.upload.processing', color: 'primary' },
  failed: { labelKey: 'imports.upload.failed', color: 'error' },
} as const satisfies Record<
  Exclude<UploadItemStatus, 'succeeded'>,
  { labelKey: string; color: 'default' | 'primary' | 'error' }
>;

const BYTES_PER_KILOBYTE = 1024;

function formatSize({
  bytes,
  t,
  formatter,
}: {
  bytes: number;
  t: T;
  formatter: AppFormatter;
}): string {
  const megabytes = bytes / BYTES_PER_MEGABYTE;
  if (megabytes >= 1) {
    return t('imports.upload.sizeMegabytes', {
      size: formatter.megabytes(megabytes),
    });
  }
  return t('imports.upload.sizeKilobytes', {
    size: formatter.number({
      value: Math.max(1, Math.round(bytes / BYTES_PER_KILOBYTE)),
    }),
  });
}

type UploadQueueListProps = {
  items: UploadItem[];
  isRunning: boolean;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onPaymentMonthChange: (id: string, paymentMonth: string) => void;
};

export default function UploadQueueList({
  items,
  isRunning,
  onRemove,
  onRetry,
  onPaymentMonthChange,
}: UploadQueueListProps) {
  const t = useT();
  const formatter = useAppFormat();
  if (items.length === 0) {
    return null;
  }

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
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap title={item.file.name}>
                {item.file.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {formatSize({ bytes: item.file.size, t, formatter })}
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={0.5}
              sx={{
                alignItems: 'center',
              }}
            >
              {item.status === 'succeeded' ? (
                <CheckCircleOutlineRoundedIcon fontSize="small" color="success" />
              ) : (
                <Chip
                  size="small"
                  label={t(STATUS_CHIPS[item.status].labelKey)}
                  color={STATUS_CHIPS[item.status].color}
                />
              )}

              {item.status === 'failed' && (
                <Tooltip
                  title={isRunning ? t('imports.upload.waitForBatch') : t('imports.upload.retry')}
                >
                  <span>
                    <IconButton
                      size="small"
                      aria-label={t('imports.upload.retryFile', {
                        fileName: item.file.name,
                      })}
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
                  aria-label={t('imports.upload.removeFile', {
                    fileName: item.file.name,
                  })}
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
              label={t('imports.upload.monthLabel')}
              value={item.paymentMonth}
              onChange={(e) => onPaymentMonthChange(item.id, e.target.value)}
              disabled={item.status !== 'queued'}
              placeholder={t('imports.upload.monthPlaceholder')}
              error={isUnreadablePaymentMonth(item.paymentMonth)}
              helperText={
                isUnreadablePaymentMonth(item.paymentMonth)
                  ? t('imports.upload.monthFormatError')
                  : undefined
              }
              sx={{ mt: 1.5 }}
            />
          )}

          {(item.status === 'uploading' || item.status === 'processing') && (
            <LinearProgress
              variant={item.status === 'uploading' ? 'determinate' : 'indeterminate'}
              value={item.progress}
              sx={{ mt: 1.5, borderRadius: 1 }}
            />
          )}

          {item.status === 'failed' && (
            <Typography
              variant="caption"
              color="error"
              sx={{
                display: 'block',
                mt: 1,
              }}
            >
              {describeUploadError({ error: item.error, t })}
            </Typography>
          )}
        </Box>
      ))}
    </Stack>
  );
}
