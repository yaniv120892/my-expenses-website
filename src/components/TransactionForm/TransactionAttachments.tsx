import React, { useCallback, useEffect, useState } from 'react';
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
import {
  MAX_UPLOAD_LABEL,
  exceedsUploadLimit,
  megabytesRoundedUp,
} from '@/shared/uploadLimits';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import { useTransactionFilesQuery } from '../../hooks/useTransactionFilesQuery';
import { TransactionFile } from '../../types';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

type Props = {
  transactionId?: string;
  pendingFiles: File[];
  setPendingFiles: (files: File[]) => void;
  filesToRemove: string[];
  setFilesToRemove: (ids: string[]) => void;
  submitButtonLabel?: string;
};

function failureReason(err: unknown): string | null {
  if (err instanceof Error) {
    return err.message;
  }
  return typeof err === 'string' ? err : null;
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

/** Minting the URL in the render body leaked a blob per render, for the life of the document. */
function PendingFileThumbnail({ file }: { file: File }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!objectUrl) {
    return null;
  }
  return <FileThumbnail src={objectUrl} alt={file.name} />;
}

export default function TransactionAttachments({
  transactionId,
  pendingFiles = [],
  setPendingFiles,
  filesToRemove = [],
  setFilesToRemove,
  submitButtonLabel,
}: Props) {
  const t = useT();
  const formatter = useAppFormat();
  const [error, setError] = useState<string | null>(null);

  const { data: files = [], isLoading: isFilesLoading } =
    useTransactionFilesQuery(transactionId || '');

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) {
        return;
      }
      if (exceedsUploadLimit(file.size)) {
        setError(
          t('transactions.attachments.tooLarge', {
            fileName: file.name,
            size: formatter.megabytes(megabytesRoundedUp(file.size)),
            limit: MAX_UPLOAD_LABEL,
          }),
        );
        return;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(t('transactions.attachments.typeNotAllowed'));
        return;
      }
      setPendingFiles([...pendingFiles, file]);
    },
    [setPendingFiles, pendingFiles, t, formatter],
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
    const reason = failureReason(err);
    setError(
      reason
        ? t('transactions.attachments.downloadFailedWithReason', { reason })
        : t('transactions.attachments.downloadFailed'),
    );
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
            {t('transactions.attachments.title', { count: attachedCount })}
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
              sx={{ color: isDragActive ? 'primary.main' : 'text.primary' }}
            >
              {isDragActive
                ? t('transactions.attachments.drop')
                : t('transactions.attachments.select', {
                    limit: MAX_UPLOAD_LABEL,
                  })}
            </Typography>
          </Box>
          {transactionId && (
            <Box sx={{ maxHeight: 220, overflowY: 'auto', mb: 2 }}>
              <Stack spacing={1}>
                {isFilesLoading ? (
                  <Typography variant="body2">
                    {t('transactions.attachments.loading')}
                  </Typography>
                ) : files.length === 0 ? (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('transactions.attachments.empty')}
                  </Typography>
                ) : (
                  files.map((file: TransactionFile) => {
                    const markedForRemoval = filesToRemove.includes(file.id);
                    return (
                      <Stack
                        key={file.id}
                        direction="row"
                        spacing={2}
                        sx={{
                          alignItems: 'center',
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
                            markedForRemoval
                              ? t('transactions.attachments.undoRemove')
                              : t('transactions.attachments.remove')
                          }
                          onClick={() => handleToggleRemove(file.id)}
                          size="small"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          aria-label={t('transactions.attachments.download')}
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
                  {t('transactions.attachments.pendingTitle')}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  <HourglassEmptyIcon
                    fontSize="inherit"
                    sx={{ mr: 0.5, verticalAlign: 'middle' }}
                  />
                  {t('transactions.attachments.pendingHintBefore')}{' '}
                  <b>
                    {submitButtonLabel ?? t('transactions.form.submit.update')}
                  </b>
                  {t('transactions.attachments.pendingHintAfter')}
                </Typography>
                {pendingFiles.map((file, idx) => (
                  <Stack
                    key={file.name + file.size + idx}
                    direction="row"
                    spacing={2}
                    sx={{
                      alignItems: 'center',
                      border: '1px dashed',
                      borderColor: 'primary.light',
                      bgcolor: 'action.hover',
                      borderRadius: 2,
                      p: 1,
                    }}
                  >
                    {file.type.startsWith('image/') && (
                      <PendingFileThumbnail file={file} />
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
                        {t('transactions.attachments.willUpload')}
                      </Box>
                    </Typography>
                    <IconButton
                      aria-label={t('transactions.attachments.removePending')}
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
