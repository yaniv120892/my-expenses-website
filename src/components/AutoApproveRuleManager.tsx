"use client";

import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  Typography,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CategorySelect from "./CategorySelect";
import {
  useAutoApproveRulesQuery,
  useCreateAutoApproveRuleMutation,
  useUpdateAutoApproveRuleMutation,
  useDeleteAutoApproveRuleMutation,
} from "../hooks/useImports";
import { AutoApproveRule } from "../types/import";
import { TransactionType } from "../types";

interface RuleFormState {
  descriptionPattern: string;
  categoryId: string;
  type: TransactionType;
}

const emptyForm: RuleFormState = {
  descriptionPattern: "",
  categoryId: "",
  type: "EXPENSE" as TransactionType,
};

export default function AutoApproveRuleManager() {
  const { data: rules = [], isLoading } = useAutoApproveRulesQuery();
  const createMutation = useCreateAutoApproveRuleMutation();
  const updateMutation = useUpdateAutoApproveRuleMutation();
  const deleteMutation = useDeleteAutoApproveRuleMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoApproveRule | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyForm);

  const handleOpen = (rule?: AutoApproveRule) => {
    if (rule) {
      setEditingRule(rule);
      setForm({
        descriptionPattern: rule.descriptionPattern,
        categoryId: rule.categoryId,
        type: rule.type,
      });
    } else {
      setEditingRule(null);
      setForm(emptyForm);
    }
    setFormOpen(true);
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditingRule(null);
    setForm(emptyForm);
  };

  const handleSubmit = async () => {
    if (editingRule) {
      await updateMutation.mutateAsync({ ruleId: editingRule.id, data: form });
    } else {
      await createMutation.mutateAsync(form);
    }
    handleClose();
  };

  const handleToggle = async (rule: AutoApproveRule) => {
    await updateMutation.mutateAsync({
      ruleId: rule.id,
      data: { isActive: !rule.isActive },
    });
  };

  const handleDelete = async (ruleId: string) => {
    await deleteMutation.mutateAsync(ruleId);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h6">Auto-Approve Rules</Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
          sx={{ textTransform: "none" }}
        >
          Add Rule
        </Button>
      </Box>

      {rules.length === 0 ? (
        <Typography color="text.secondary" align="center" py={2}>
          No auto-approve rules yet. Create one to automatically approve
          matching imported transactions.
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Pattern</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>{rule.descriptionPattern}</TableCell>
                <TableCell>{rule.category?.name || rule.categoryId}</TableCell>
                <TableCell>{rule.type}</TableCell>
                <TableCell>
                  <Switch
                    checked={rule.isActive}
                    onChange={() => handleToggle(rule)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleOpen(rule)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(rule.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={formOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingRule ? "Edit Rule" : "Create Auto-Approve Rule"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              label="Description Pattern"
              value={form.descriptionPattern}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  descriptionPattern: e.target.value,
                }))
              }
              placeholder='e.g. "Wolt" matches "Wolt delivery", "WOLT*123"'
              fullWidth
              required
            />
            <CategorySelect
              value={form.categoryId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, categoryId: e.target.value }))
              }
              required
            />
            <TextField
              select
              label="Type"
              value={form.type}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  type: e.target.value as TransactionType,
                }))
              }
              fullWidth
              required
            >
              <MenuItem value="EXPENSE">Expense</MenuItem>
              <MenuItem value="INCOME">Income</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={
              !form.descriptionPattern ||
              !form.categoryId ||
              createMutation.isPending ||
              updateMutation.isPending
            }
          >
            {editingRule ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
