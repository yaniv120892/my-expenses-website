"use client";

import React, { useState } from "react";
import {
  Alert,
  Box,
  Collapse,
  IconButton,
  LinearProgress,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import { BatchResult } from "../types/import";

interface BatchProgressIndicatorProps {
  result: BatchResult | null;
  isLoading: boolean;
  onClose: () => void;
}

export default function BatchProgressIndicator({
  result,
  isLoading,
  onClose,
}: BatchProgressIndicatorProps) {
  const [showErrors, setShowErrors] = useState(false);

  if (isLoading) {
    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Processing batch operation...
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (!result) return null;

  const severity =
    result.failed === 0
      ? "success"
      : result.succeeded === 0
        ? "error"
        : "warning";

  return (
    <Box sx={{ mb: 2 }}>
      <Alert
        severity={severity}
        action={
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      >
        <Typography variant="body2">
          {result.succeeded} of {result.total} transactions processed
          successfully.
          {result.failed > 0 && ` ${result.failed} failed.`}
        </Typography>
        {result.errors.length > 0 && (
          <>
            <IconButton
              size="small"
              onClick={() => setShowErrors(!showErrors)}
              sx={{ ml: 1 }}
            >
              <ExpandMoreIcon
                sx={{
                  transform: showErrors ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s",
                }}
              />
            </IconButton>
            <Collapse in={showErrors}>
              <Box sx={{ mt: 1 }}>
                {result.errors.map((err, i) => (
                  <Typography key={i} variant="caption" display="block">
                    {err.id}: {err.error}
                  </Typography>
                ))}
              </Box>
            </Collapse>
          </>
        )}
      </Alert>
    </Box>
  );
}
