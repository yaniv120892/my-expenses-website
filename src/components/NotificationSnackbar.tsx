import React from "react";
import { Snackbar, Alert } from "@mui/material";

type NotificationSnackbarProps = {
  open: boolean;
  message: string;
  severity?: "success" | "error" | "info" | "warning";
  onClose: () => void;
  autoHideDuration?: number;
};

export default function NotificationSnackbar({
  open,
  message,
  severity = "success",
  onClose,
  autoHideDuration = 4000,
}: NotificationSnackbarProps) {
  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
    >
      <Alert severity={severity} sx={{ width: "100%" }}>
        {message}
      </Alert>
    </Snackbar>
  );
}
