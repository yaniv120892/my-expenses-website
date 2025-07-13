import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Stack,
  Snackbar,
  Alert,
  TextField,
} from "@mui/material";
import { UploadFile } from "@mui/icons-material";
import {
  useProcessImportMutation,
  useImportUploadMutation,
} from "../hooks/useImports";

interface FileUploadProps {
  onUploadComplete?: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [paymentMonth, setPaymentMonth] = useState<string>("");
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

        const formData = new FormData();
        formData.append("file", file);
        formData.append("paymentMonth", paymentMonth);

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
        console.error("Upload failed with error:", error);
        setError(
          error instanceof Error ? error.message : "Failed to upload file"
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
    ]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    disabled: isUploading || processImportMutation.isPending,
  });

  const isDisabled = isUploading || processImportMutation.isPending;

  return (
    <Box>
      <TextField
        fullWidth
        label="Payment Month (MM/YYYY)"
        variant="outlined"
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
          p: 3,
          border: "2px dashed",
          borderColor: isDragActive ? "primary.main" : "grey.300",
          borderRadius: 1,
          bgcolor: isDragActive ? "primary.50" : "background.paper",
          cursor: isDisabled ? "not-allowed" : "pointer",
          transition: "all 0.2s",
          "&:hover": {
            borderColor: "primary.main",
            bgcolor: "primary.50",
          },
        }}
      >
        <input {...getInputProps()} />
        <Stack spacing={2} alignItems="center">
          <UploadFile
            sx={{
              fontSize: 48,
              color: isDragActive ? "primary.main" : "grey.400",
            }}
          />
          <Typography
            align="center"
            color={isDragActive ? "primary.main" : "text.primary"}
          >
            {isDragActive
              ? "Drop the file here"
              : "Drag and drop a file here, or click to select"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Supported formats: XLSX, CSV
          </Typography>
          {!isDisabled && (
            <Button
              variant="contained"
              size="small"
              sx={{
                textTransform: "none",
                fontWeight: 700,
                backgroundColor: "var(--accent-red)",
                "&:hover": {
                  backgroundColor: "var(--accent-red-dark)",
                },
              }}
            >
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
            sx={{
              "& .MuiLinearProgress-bar": {
                backgroundColor: "var(--accent-red)",
              },
            }}
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
              : "Processing import..."}
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
