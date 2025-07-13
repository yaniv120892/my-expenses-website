import React, { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  Box,
  Typography,
  IconButton,
  Snackbar,
  Alert,
  Link,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CloseIcon from "@mui/icons-material/Close";
import Image from "next/image";
import { useTransactionFilesQuery } from "../../hooks/useTransactionFilesQuery";
import { TransactionFile } from "../../types";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DownloadIcon from "@mui/icons-material/Download";
import Tooltip from "@mui/material/Tooltip";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const ATTACHMENTS_TOOLTIP_SEEN_KEY = "attachmentsTooltipSeen";

interface Props {
  transactionId?: string;
  pendingFiles: File[];
  setPendingFiles: (files: File[]) => void;
  filesToRemove: string[];
  setFilesToRemove: (ids: string[]) => void;
  submitButtonLabel?: string;
}

export default function TransactionAttachments({
  transactionId,
  pendingFiles = [],
  setPendingFiles,
  filesToRemove = [],
  setFilesToRemove,
  submitButtonLabel = "Update",
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [showAttachmentsTooltip, setShowAttachmentsTooltip] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      !localStorage.getItem(ATTACHMENTS_TOOLTIP_SEEN_KEY)
    ) {
      setShowAttachmentsTooltip(true);
      localStorage.setItem(ATTACHMENTS_TOOLTIP_SEEN_KEY, "true");
    }
  }, []);

  const handleAttachmentsTooltipClose = () => {
    setShowAttachmentsTooltip(false);
  };

  const { data: files = [], isLoading: isFilesLoading } =
    useTransactionFilesQuery(transactionId || "");

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      if (file.size > MAX_SIZE) {
        setError("File size exceeds 10MB limit");
        return;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("File type not allowed");
        return;
      }
      setPendingFiles([...pendingFiles, file]);
    },
    [setPendingFiles, pendingFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALLOWED_TYPES.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
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
    let message = "Failed to download file.";
    if (err instanceof Error) {
      message += ` Error: ${err.message}`;
    } else if (typeof err === "string") {
      message += ` Error: ${err}`;
    }
    setError(message);
  };

  const downloadFile = async (
    file: TransactionFile,
    fileUrlOverride?: string
  ) => {
    try {
      const isMobile =
        /android|iphone|ipad|ipod|opera mini|iemobile|mobile/i.test(
          navigator.userAgent
        );
      const fileUrl = fileUrlOverride || file.previewFileUrl;
      if (isMobile) {
        window.open(fileUrl, "_blank");
        return;
      }
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      handleDownloadFileError(err);
    }
  };

  const attachedCount = Math.max(
    0,
    files.length - filesToRemove.length + pendingFiles.length
  );

  return (
    <Box mt={3} mb={2}>
      <Accordion defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
          <Tooltip
            title={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <span>
                  📎 <b>New!</b> You can now attach files to transactions
                </span>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAttachmentsTooltipClose();
                  }}
                  sx={{
                    color: "white",
                    p: 0.5,
                    minWidth: "auto",
                    "&:hover": {
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                    },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            }
            open={showAttachmentsTooltip}
            arrow
            placement="left"
            onClose={handleAttachmentsTooltipClose}
            disableFocusListener
            disableHoverListener
            disableTouchListener
          >
            <Typography variant="subtitle1" fontWeight={600}>
              Attachments ({attachedCount})
            </Typography>
          </Tooltip>
        </AccordionSummary>
        <AccordionDetails>
          <Box
            {...getRootProps()}
            sx={{
              p: 3,
              border: "2px dashed",
              borderColor: isDragActive ? "primary.main" : "grey.300",
              borderRadius: 2,
              bgcolor: isDragActive ? "primary.50" : "background.paper",
              cursor: "pointer",
              transition: "all 0.2s",
              mb: 2,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <input {...getInputProps()} />
            <CloudUploadIcon sx={{ fontSize: 32, color: "grey.500" }} />
            <Typography color={isDragActive ? "primary.main" : "text.primary"}>
              {isDragActive
                ? "Drop the file here"
                : "Drag and drop or click to select a file (max 10MB)"}
            </Typography>
          </Box>
          {transactionId && (
            <Box
              sx={{
                maxHeight: 220,
                overflowY: "auto",
                maxWidth: 440,
                width: "100%",
                mx: "auto",
                mt: 1,
                mb: 2,
              }}
            >
              <Box display="flex" flexDirection="column" gap={1}>
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
                      <Box
                        key={file.id}
                        display="flex"
                        alignItems="center"
                        gap={2}
                        sx={{
                          borderBottom: "1px solid #eee",
                          pb: 1,
                          mb: 1,
                          opacity: markedForRemoval ? 0.5 : 1,
                        }}
                      >
                        {file.mimeType.startsWith("image/") ? (
                          <Image
                            src={file.previewFileUrl}
                            alt={file.fileName}
                            width={40}
                            height={40}
                            style={{ objectFit: "cover", borderRadius: 4 }}
                            unoptimized
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
                              ? "line-through"
                              : "none",
                          }}
                        >
                          {file.fileName}
                        </Typography>
                        <IconButton
                          aria-label={
                            markedForRemoval ? "Undo remove" : "Remove file"
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
                      </Box>
                    );
                  })
                )}
              </Box>
            </Box>
          )}
          {pendingFiles.length > 0 && (
            <Box
              sx={{
                maxHeight: 220,
                overflowY: "auto",
                maxWidth: 440,
                width: "100%",
                mx: "auto",
                mt: 1,
                mb: 2,
              }}
            >
              <Box display="flex" flexDirection="column" gap={1}>
                <Typography variant="subtitle2" color="primary" mb={0.5}>
                  Pending Attachments
                </Typography>
                <Typography variant="caption" color="text.secondary" mb={1}>
                  <HourglassEmptyIcon
                    fontSize="inherit"
                    sx={{ mr: 0.5, verticalAlign: "middle" }}
                  />
                  These files will be uploaded and attached only after you press{" "}
                  <b>{submitButtonLabel}</b>.
                </Typography>
                {pendingFiles.map((file, idx) => (
                  <Box
                    key={file.name + file.size + idx}
                    display="flex"
                    alignItems="center"
                    gap={2}
                    sx={{
                      border: "1px dashed #90caf9",
                      background: "#e3f2fd",
                      borderRadius: 2,
                      p: 1,
                      mb: 1,
                    }}
                  >
                    {file.type.startsWith("image/") ? (
                      <Image
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        width={40}
                        height={40}
                        style={{ objectFit: "cover", borderRadius: 4 }}
                      />
                    ) : (
                      <Typography variant="body2">{file.name}</Typography>
                    )}
                    <Typography
                      variant="body2"
                      sx={{ flex: 1, fontStyle: "italic" }}
                    >
                      {file.name}{" "}
                      <span
                        style={{
                          color: "#1976d2",
                          fontWeight: 500,
                          marginLeft: 8,
                        }}
                      >
                        (will be uploaded)
                      </span>
                    </Typography>
                    <IconButton
                      aria-label="Remove pending file"
                      onClick={() => handleRemovePending(idx)}
                      size="small"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
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
