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

interface FileUploadProps {
  onUploadComplete?: () => void;
  onRunningChange?: (isRunning: boolean) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onUploadComplete,
  onRunningChange,
}) => {
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
    (acceptedFiles: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        setError(
          `${rejections.length} file(s) were rejected. Supported formats: XLSX, XLS, CSV (max ${MAX_FILES_PER_BATCH} per batch).`,
        );
      }
      if (acceptedFiles.length === 0) {
        return;
      }

      const rejectedAsFull = addFiles(acceptedFiles, paymentMonth);
      if (rejectedAsFull > 0) {
        setError(
          `The queue holds ${MAX_FILES_PER_BATCH} files, so ${rejectedAsFull} were not added. Upload these first.`,
        );
      }
    },
    [addFiles, paymentMonth],
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
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          fullWidth
          label="Default Payment Month (MM/YYYY)"
          value={paymentMonth}
          onChange={(e) => setPaymentMonth(e.target.value)}
          disabled={isRunning}
          placeholder="e.g., 01/2024 (Optional)"
          helperText="Applied to files as you add them. Leave blank if the month is in the filename (e.g., XXXX_01_2024.csv)."
        />
        <Button
          variant="outlined"
          onClick={() => applyPaymentMonthToAll(paymentMonth)}
          disabled={isRunning || items.length === 0}
          sx={{ mt: 1, flexShrink: 0 }}
        >
          Apply to all
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
        <Stack spacing={1.5} alignItems="center">
          <UploadFileOutlinedIcon
            sx={{
              fontSize: 44,
              color: isDragActive ? 'primary.main' : 'text.secondary',
            }}
          />
          <Typography
            align="center"
            color={isDragActive ? 'primary.main' : 'text.primary'}
          >
            {isDragActive
              ? 'Drop the files here'
              : 'Drag and drop files here, or click to select'}
          </Typography>
          <Typography variant="caption" color="text.secondary" align="center">
            Supported formats: XLSX, XLS, CSV. Each file becomes its own import.
          </Typography>
          {!isRunning && (
            <Button variant="contained" size="small">
              Select Files
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
              ? 'Upload 1 file'
              : `Upload ${queuedCount} files`}
          </Button>
          {hasFailures && (
            <Button
              variant="outlined"
              disabled={isRunning}
              onClick={retryAllFailed}
              sx={{ flexShrink: 0 }}
            >
              Retry failed
            </Button>
          )}
        </Stack>
      )}

      {summary && (
        <Box sx={{ mt: 2 }}>
          <BatchProgressIndicator
            result={summary}
            isLoading={false}
            itemLabel="files"
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
