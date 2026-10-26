'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import {
  Alert,
  Box,
  Button,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import BatchProgressIndicator from '@/components/BatchProgressIndicator';
import { useMultiFileImport } from '@/hooks/useMultiFileImport';
import { MAX_FILES_PER_BATCH } from '@/utils/importUploadQueue';
import UploadQueueList from './UploadQueueList';
import { isUnreadablePaymentMonth } from '@/utils/paymentMonth';
import {
  MAX_UPLOAD_LABEL,
  exceedsUploadLimit,
  megabytesRoundedUp,
} from '@/shared/uploadLimits';
import { useT } from '@/i18n/useT';
import type { T } from '@/i18n/useT.types';
import { useAppFormat, type AppFormatter } from '@/i18n/useAppFormat';

type FileUploadProps = {
  onUploadComplete?: () => void;
  onRunningChange?: (isRunning: boolean) => void;
};

function tooLargeMessage({
  file,
  t,
  formatter,
}: {
  file: File;
  t: T;
  formatter: AppFormatter;
}): string {
  return t('imports.upload.tooLarge', {
    fileName: file.name,
    size: formatter.megabytes(megabytesRoundedUp(file.size)),
    limit: MAX_UPLOAD_LABEL,
  });
}

const FileUpload: React.FC<FileUploadProps> = ({
  onUploadComplete,
  onRunningChange,
}) => {
  const t = useT();
  const formatter = useAppFormat();
  const [paymentMonth, setPaymentMonth] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    items,
    isRunning,
    summary,
    hasFailures,
    queuedCount,
    addFiles,
    removeItem,
    setPaymentMonth: setItemPaymentMonth,
    applyPaymentMonthToAll,
    start,
    retryAllFailed,
    retryItem,
    reset,
  } = useMultiFileImport({ onAllSucceeded: onUploadComplete });

  useEffect(() => {
    onRunningChange?.(isRunning);
  }, [isRunning, onRunningChange]);

  const onDrop = useCallback(
    (droppedFiles: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        setError(
          t('imports.upload.rejected', {
            count: rejections.length,
            max: MAX_FILES_PER_BATCH,
          }),
        );
      }
      const oversized = droppedFiles.filter((file) =>
        exceedsUploadLimit(file.size),
      );
      if (oversized.length > 0) {
        setError(
          oversized
            .map((file) => tooLargeMessage({ file, t, formatter }))
            .join(' '),
        );
      }
      const acceptedFiles = droppedFiles.filter(
        (file) => !exceedsUploadLimit(file.size),
      );
      if (acceptedFiles.length === 0) {
        return;
      }

      const rejectedAsFull = addFiles(acceptedFiles, paymentMonth);
      if (rejectedAsFull > 0) {
        setError(
          t('imports.upload.queueFull', {
            max: MAX_FILES_PER_BATCH,
            count: rejectedAsFull,
          }),
        );
      }
    },
    [addFiles, paymentMonth, t, formatter],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    multiple: true,
    maxFiles: MAX_FILES_PER_BATCH,
    disabled: isRunning,
  });

  return (
    <Box sx={{ pt: 1 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'flex-start',
        }}
      >
        <TextField
          fullWidth
          label={t('imports.upload.defaultMonthLabel')}
          value={paymentMonth}
          onChange={(e) => setPaymentMonth(e.target.value)}
          disabled={isRunning}
          placeholder={t('imports.upload.defaultMonthPlaceholder')}
          error={isUnreadablePaymentMonth(paymentMonth)}
          helperText={
            isUnreadablePaymentMonth(paymentMonth)
              ? t('imports.upload.monthFormatError')
              : t('imports.upload.defaultMonthHelp')
          }
        />
        <Button
          variant="outlined"
          onClick={() => applyPaymentMonthToAll(paymentMonth)}
          disabled={isRunning || items.length === 0}
          sx={{ mt: 1, flexShrink: 0 }}
        >
          {t('imports.upload.applyToAll')}
        </Button>
      </Stack>

      <Box
        {...getRootProps()}
        sx={{
          mt: 2,
          p: { xs: 3, sm: 4 },
          border: 2,
          borderStyle: 'dashed',
          borderColor: isDragActive ? 'primary.main' : 'divider',
          borderRadius: 2,
          bgcolor: isDragActive ? 'action.hover' : 'background.paper',
          cursor: isRunning ? 'not-allowed' : 'pointer',
          transition: 'border-color 0.2s, background-color 0.2s',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
          },
        }}
      >
        <input {...getInputProps()} />
        <Stack
          spacing={1.5}
          sx={{
            alignItems: 'center',
          }}
        >
          <UploadFileOutlinedIcon
            sx={{
              fontSize: 44,
              color: isDragActive ? 'primary.main' : 'text.secondary',
            }}
          />
          <Typography
            align="center"
            sx={{ color: isDragActive ? 'primary.main' : 'text.primary' }}
          >
            {isDragActive
              ? t('imports.upload.dropHere')
              : t('imports.upload.dragOrClick')}
          </Typography>
          <Typography
            variant="caption"
            align="center"
            sx={{
              color: 'text.secondary',
            }}
          >
            {t('imports.upload.formats', { limit: MAX_UPLOAD_LABEL })}
          </Typography>
          {!isRunning && (
            <Button variant="contained" size="small">
              {t('imports.upload.selectFiles')}
            </Button>
          )}
        </Stack>
      </Box>

      <UploadQueueList
        items={items}
        isRunning={isRunning}
        onRemove={removeItem}
        onRetry={retryItem}
        onPaymentMonthChange={setItemPaymentMonth}
      />

      {(queuedCount > 0 || hasFailures) && (
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            fullWidth
            disabled={isRunning || queuedCount === 0}
            onClick={start}
          >
            {queuedCount === 1
              ? t('imports.upload.start.one')
              : t('imports.upload.start.other', { count: queuedCount })}
          </Button>
          {hasFailures && (
            <Button
              variant="outlined"
              disabled={isRunning}
              onClick={retryAllFailed}
              sx={{ flexShrink: 0 }}
            >
              {t('imports.upload.retryFailed')}
            </Button>
          )}
        </Stack>
      )}

      {summary && (
        <Box sx={{ mt: 2 }}>
          <BatchProgressIndicator
            result={summary}
            isLoading={false}
            itemKind="files"
            onClose={reset}
          />
        </Box>
      )}

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FileUpload;
