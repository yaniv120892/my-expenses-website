"use client";

import React, { useState } from "react";
import { Box, Button, Stack, Chip } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import DeselectIcon from "@mui/icons-material/Deselect";
import BatchConfirmDialog from "./BatchConfirmDialog";
import BatchProgressIndicator from "./BatchProgressIndicator";
import {
  useBatchActionMutation,
  useApplyAutoApproveRulesMutation,
} from "../hooks/useImports";
import { BatchResult } from "../types/import";

interface BatchActionToolbarProps {
  importId: string;
  selectedIds: string[];
  pendingCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  hasAutoApproveRules: boolean;
}

export default function BatchActionToolbar({
  importId,
  selectedIds,
  pendingCount,
  onSelectAll,
  onClearSelection,
  hasAutoApproveRules,
}: BatchActionToolbarProps) {
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "approve" | "ignore";
    scope: "all" | "selected";
  }>({ open: false, action: "approve", scope: "all" });
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);

  const batchMutation = useBatchActionMutation(importId);
  const autoApproveMutation = useApplyAutoApproveRulesMutation(importId);

  const handleConfirm = async () => {
    const transactionIds =
      confirmDialog.scope === "selected" ? selectedIds : undefined;

    try {
      const result = await batchMutation.mutateAsync({
        importId,
        action: confirmDialog.action,
        transactionIds,
      });
      setBatchResult(result);
      onClearSelection();
    } finally {
      setConfirmDialog((prev) => ({ ...prev, open: false }));
    }
  };

  const handleAutoApprove = async () => {
    try {
      const result = await autoApproveMutation.mutateAsync();
      setBatchResult(result);
    } catch {
      // error handled by mutation
    }
  };

  const isProcessing = batchMutation.isPending || autoApproveMutation.isPending;
  const hasSelection = selectedIds.length > 0;
  const confirmCount =
    confirmDialog.scope === "selected" ? selectedIds.length : pendingCount;

  if (pendingCount === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <BatchProgressIndicator
        result={batchResult}
        isLoading={isProcessing}
        onClose={() => setBatchResult(null)}
      />

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          size="small"
          variant="outlined"
          startIcon={hasSelection ? <DeselectIcon /> : <SelectAllIcon />}
          onClick={hasSelection ? onClearSelection : onSelectAll}
          sx={{ textTransform: "none" }}
        >
          {hasSelection ? "Clear" : "Select All"}
        </Button>

        {hasSelection && (
          <Chip
            label={`${selectedIds.length} selected`}
            size="small"
            color="primary"
            variant="outlined"
          />
        )}

        <Button
          size="small"
          variant="contained"
          color="success"
          startIcon={<CheckIcon />}
          onClick={() =>
            setConfirmDialog({ open: true, action: "approve", scope: "all" })
          }
          disabled={isProcessing}
          sx={{ textTransform: "none" }}
        >
          Approve All ({pendingCount})
        </Button>

        {hasSelection && (
          <Button
            size="small"
            variant="contained"
            color="success"
            startIcon={<CheckIcon />}
            onClick={() =>
              setConfirmDialog({
                open: true,
                action: "approve",
                scope: "selected",
              })
            }
            disabled={isProcessing}
            sx={{ textTransform: "none" }}
          >
            Approve Selected ({selectedIds.length})
          </Button>
        )}

        <Button
          size="small"
          variant="contained"
          color="warning"
          startIcon={<CloseIcon />}
          onClick={() =>
            setConfirmDialog({ open: true, action: "ignore", scope: "all" })
          }
          disabled={isProcessing}
          sx={{ textTransform: "none" }}
        >
          Ignore All ({pendingCount})
        </Button>

        {hasSelection && (
          <Button
            size="small"
            variant="contained"
            color="warning"
            startIcon={<CloseIcon />}
            onClick={() =>
              setConfirmDialog({
                open: true,
                action: "ignore",
                scope: "selected",
              })
            }
            disabled={isProcessing}
            sx={{ textTransform: "none" }}
          >
            Ignore Selected ({selectedIds.length})
          </Button>
        )}

        {hasAutoApproveRules && (
          <Button
            size="small"
            variant="contained"
            color="info"
            startIcon={<AutoFixHighIcon />}
            onClick={handleAutoApprove}
            disabled={isProcessing}
            sx={{ textTransform: "none" }}
          >
            Auto-Approve Rules
          </Button>
        )}
      </Stack>

      <BatchConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={handleConfirm}
        action={confirmDialog.action}
        count={confirmCount}
        isLoading={batchMutation.isPending}
      />
    </Box>
  );
}
