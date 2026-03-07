"use client";

import { Box, Button, Typography } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="60vh"
      gap={2}
    >
      <ErrorOutlineIcon sx={{ fontSize: 64, color: "error.main" }} />
      <Typography variant="h6" color="text.primary">
        Something went wrong
      </Typography>
      <Typography color="text.secondary" textAlign="center" maxWidth={400}>
        {error.message || "An unexpected error occurred."}
      </Typography>
      <Button variant="contained" color="primary" onClick={reset}>
        Try Again
      </Button>
    </Box>
  );
}
