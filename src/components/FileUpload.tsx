'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Stack,
  Snackbar,
  Alert,
  TextField,
} from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import {
  useProcessImportMutation,
  useImportUploadMutation,
} from '../hooks/useImports';

interface FileUploadProps {
  onUploadComplete?: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [paymentMonth, setPaymentMonth] = useState<string>('');
  const processImportMutation = useProcessImportMutation();
  const importUploadMutation = useImportUploadMutation();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      try {
        setError(null);
        setIsUploading(true);
        setUploadProgress(0);

        const arrayBuffer = await file.arrayBuffer();
        const blob = new Blob([arrayBuffer], {
          type: file.type || 'application/octet-stream',
        });

        const formData = new FormData();
        formData.append('file', blob, file.name);
        formData.append('paymentMonth', paymentMonth);

        const { fileUrl } = await importUploadMutation.mutateAsync({
          formData,
          onProgress: (progress: number) => setUploadProgress(progress),
        });

        await processImportMutation.mutateAsync({
          fileUrl,
          originalFileName: file.name,
          paymentMonth: paymentMonth || undefined,
        });

        onUploadComplete?.();
      } catch (error) {
        console.error('Upload failed with error:', error);
        setError(
          error instanceof Error ? error.message : 'Failed to upload file',
        );
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [
      processImportMutation,
      onUploadComplete,
      paymentMonth,
      importUploadMutation,
    ],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    disabled: isUploading || processImportMutation.isPending,
  });

  const isDisabled = isUploading || processImportMutation.isPending;

  return (
    <Box sx={{ pt: 1 }}>
      <TextField
        fullWidth
        label="Payment Month (MM/YYYY)"
        value={paymentMonth}
        onChange={(e) => setPaymentMonth(e.target.value)}
        sx={{ mb: 3 }}
        disabled={isDisabled}
        placeholder="e.g., 01/2024 (Optional)"
        helperText="Leave blank if month is in filename (e.g., XXXX_01_2024.csv)"
      />

      <Box
        {...getRootProps()}
        sx={{
          p: { xs: 3, sm: 4 },
          border: 2,
          borderStyle: 'dashed',
          borderColor: isDragActive ? 'primary.main' : 'divider',
          borderRadius: 2,
          bgcolor: isDragActive ? 'action.hover' : 'background.paper',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
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
              ? 'Drop the file here'
              : 'Drag and drop a file here, or click to select'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Supported formats: XLSX, CSV
          </Typography>
          {!isDisabled && (
            <Button variant="contained" size="small">
              Select File
            </Button>
          )}
        </Stack>
      </Box>
      {(isUploading || processImportMutation.isPending) && (
        <Box mt={2}>
          <LinearProgress
            variant="determinate"
            value={isUploading ? uploadProgress : 100}
            sx={{ borderRadius: 1 }}
          />
          <Typography
            mt={1}
            variant="caption"
            color="text.secondary"
            align="center"
            display="block"
          >
            {isUploading
              ? `Uploading... ${Math.round(uploadProgress)}%`
              : 'Processing import...'}
          </Typography>
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
