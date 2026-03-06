"use client";

import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
} from "@mui/material";

interface BatchConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  action: "approve" | "ignore";
  count: number;
  isLoading: boolean;
}

export default function BatchConfirmDialog({
  open,
  onClose,
  onConfirm,
  action,
  count,
  isLoading,
}: BatchConfirmDialogProps) {
  const actionLabel = action === "approve" ? "approve" : "ignore";

  return (
    <Dialog open={open} onClose={isLoading ? undefined : onClose}>
      <DialogTitle>Confirm Batch {action === "approve" ? "Approve" : "Ignore"}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to {actionLabel} {count} transaction
          {count !== 1 ? "s" : ""}?
          {action === "approve" &&
            " Each transaction will be created as a real transaction record."}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={action === "approve" ? "success" : "warning"}
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {isLoading ? "Processing..." : `${action === "approve" ? "Approve" : "Ignore"} ${count}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
