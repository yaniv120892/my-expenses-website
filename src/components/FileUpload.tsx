import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
  Alert,
} from "@mui/material";
import { UploadFile } from "@mui/icons-material";
import { ImportFileType } from "../types/import";
import { useProcessImportMutation } from "../hooks/useImports";

interface FileUploadProps {
  onUploadComplete?: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedImportType, setSelectedImportType] = useState<ImportFileType>(
    ImportFileType.CAL_CREDIT
  );
  const processImportMutation = useProcessImportMutation();

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
        formData.append("importType", selectedImportType);

        const response = await fetch("/api/imports/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to upload file");
        }

        const { fileUrl } = await response.json();

        await processImportMutation.mutateAsync({
          fileUrl,
          importType: selectedImportType,
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
    [processImportMutation, onUploadComplete, selectedImportType]
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
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel id="import-type-label">Import Type</InputLabel>
        <Select
          labelId="import-type-label"
          value={selectedImportType}
          label="Import Type"
          onChange={(e) =>
            setSelectedImportType(e.target.value as ImportFileType)
          }
          disabled={isDisabled}
        >
          <MenuItem value={ImportFileType.CAL_CREDIT}>Cal Credit</MenuItem>
          <MenuItem value={ImportFileType.AMERICAN_EXPRESS_CREDIT}>
            American Express
          </MenuItem>
          <MenuItem value={ImportFileType.ISRACARD_CREDIT}>Isracard</MenuItem>
        </Select>
      </FormControl>

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
