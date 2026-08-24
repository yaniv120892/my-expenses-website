import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  IconButton,
  Link,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DownloadIcon from '@mui/icons-material/Download';
import Image from 'next/image';
import { downloadBlob } from '@/utils/download';
import { useTransactionFilesQuery } from '../../hooks/useTransactionFilesQuery';
import { TransactionFile } from '../../types';

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

interface Props {
  transactionId?: string;
  pendingFiles: File[];
  setPendingFiles: (files: File[]) => void;
  filesToRemove: string[];
  setFilesToRemove: (ids: string[]) => void;
  submitButtonLabel?: string;
}

function FileThumbnail({ src, alt }: { src: string; alt: string }) {
  return (
    <Box
      sx={{
        width: 40,
        height: 40,
        flexShrink: 0,
        borderRadius: 1,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Image src={src} alt={alt} fill sizes="40px" unoptimized />
    </Box>
  );
}

export default function TransactionAttachments({
  transactionId,
  pendingFiles = [],
  setPendingFiles,
  filesToRemove = [],
  setFilesToRemove,
  submitButtonLabel = 'Update',
}: Props) {
  const [error, setError] = useState<string | null>(null);

  const { data: files = [], isLoading: isFilesLoading } =
    useTransactionFilesQuery(transactionId || '');

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) {
        return;
      }
      if (file.size > MAX_SIZE) {
        setError('File size exceeds 10MB limit');
        return;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError('File type not allowed');
        return;
      }
      setPendingFiles([...pendingFiles, file]);
    },
    [setPendingFiles, pendingFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALLOWED_TYPES.reduce(
      (acc, type) => {
        acc[type] = [];
        return acc;
      },
      {} as Record<string, string[]>,
    ),
    maxFiles: 1,
    disabled: false,
  });

  const handleToggleRemove = (fileId: string) => {
    if (filesToRemove.includes(fileId)) {
      setFilesToRemove(filesToRemove.filter((id) => id !== fileId));
    } else {
      setFilesToRemove([...filesToRemove, fileId]);
    }
  };

  const handleRemovePending = (index: number) => {
    setPendingFiles(pendingFiles.filter((_, i) => i !== index));
  };

  const handleDownloadFileError = (err: unknown) => {
    let message = 'Failed to download file.';
    if (err instanceof Error) {
      message += ` Error: ${err.message}`;
    } else if (typeof err === 'string') {
      message += ` Error: ${err}`;
    }
    setError(message);
  };

  const downloadFile = async (
    file: TransactionFile,
    fileUrlOverride?: string,
  ) => {
    try {
      const isMobile =
        /android|iphone|ipad|ipod|opera mini|iemobile|mobile/i.test(
          navigator.userAgent,
        );
      const fileUrl = fileUrlOverride || file.previewFileUrl;
      if (isMobile) {
        window.open(fileUrl, '_blank');
        return;
      }
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      downloadBlob(file.fileName, await response.blob());
    } catch (err) {
      handleDownloadFileError(err);
    }
  };

  const attachedCount = Math.max(
    0,
    files.length - filesToRemove.length + pendingFiles.length,
  );

  return (
    <Box>
      <Accordion variant="outlined" disableGutters defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Attachments ({attachedCount})
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box
            {...getRootProps()}
            sx={{
              p: 2.5,
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'divider',
              borderRadius: 2,
              bgcolor: isDragActive ? 'action.hover' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <input {...getInputProps()} />
            <CloudUploadIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
            <Typography
              variant="body2"
              color={isDragActive ? 'primary.main' : 'text.primary'}
            >
              {isDragActive
                ? 'Drop the file here'
                : 'Drag and drop or click to select a file (max 10MB)'}
            </Typography>
          </Box>
          {transactionId && (
            <Box sx={{ maxHeight: 220, overflowY: 'auto', mb: 2 }}>
              <Stack spacing={1}>
                {isFilesLoading ? (
                  <Typography variant="body2">Loading files...</Typography>
                ) : files.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No attachments yet.
                  </Typography>
                ) : (
                  files.map((file: TransactionFile) => {
                    const markedForRemoval = filesToRemove.includes(file.id);
                    return (
                      <Stack
                        key={file.id}
                        direction="row"
                        alignItems="center"
                        spacing={2}
                        sx={{
                          borderBottom: 1,
                          borderColor: 'divider',
                          pb: 1,
                          opacity: markedForRemoval ? 0.5 : 1,
                        }}
                      >
                        {file.mimeType.startsWith('image/') ? (
                          <FileThumbnail
                            src={file.previewFileUrl}
                            alt={file.fileName}
                          />
                        ) : (
                          <Link
                            href={file.previewFileUrl}
                            target="_blank"
                            rel="noopener"
                          >
                            {file.fileName}
                          </Link>
                        )}
                        <Typography
                          variant="body2"
                          sx={{
                            flex: 1,
                            textDecoration: markedForRemoval
                              ? 'line-through'
                              : 'none',
                          }}
                        >
                          {file.fileName}
                        </Typography>
                        <IconButton
                          aria-label={
                            markedForRemoval ? 'Undo remove' : 'Remove file'
                          }
                          onClick={() => handleToggleRemove(file.id)}
                          size="small"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          aria-label="Download file"
                          size="small"
                          onClick={() =>
                            downloadFile(file, file.downloadableFileUrl)
                          }
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    );
                  })
                )}
              </Stack>
            </Box>
          )}
          {pendingFiles.length > 0 && (
            <Box sx={{ maxHeight: 220, overflowY: 'auto', mb: 1 }}>
              <Stack spacing={1}>
                <Typography variant="subtitle2" color="primary">
                  Pending Attachments
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  <HourglassEmptyIcon
                    fontSize="inherit"
                    sx={{ mr: 0.5, verticalAlign: 'middle' }}
                  />
                  These files will be uploaded and attached only after you press{' '}
                  <b>{submitButtonLabel}</b>.
                </Typography>
                {pendingFiles.map((file, idx) => (
                  <Stack
                    key={file.name + file.size + idx}
                    direction="row"
                    alignItems="center"
                    spacing={2}
                    sx={{
                      border: '1px dashed',
                      borderColor: 'primary.light',
                      bgcolor: 'action.hover',
                      borderRadius: 2,
                      p: 1,
                    }}
                  >
                    {file.type.startsWith('image/') && (
                      <FileThumbnail
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                      />
                    )}
                    <Typography
                      variant="body2"
                      sx={{ flex: 1, fontStyle: 'italic' }}
                    >
                      {file.name}{' '}
                      <Box
                        component="span"
                        sx={{ fontWeight: 500, ml: 1, opacity: 0.7 }}
                      >
                        (will be uploaded)
                      </Box>
                    </Typography>
                    <IconButton
                      aria-label="Remove pending file"
                      onClick={() => handleRemovePending(idx)}
                      size="small"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
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
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
