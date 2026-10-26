'use client';

import React, { useState } from 'react';
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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CategorySelect from './CategorySelect';
import {
  useAutoApproveRulesQuery,
  useCreateAutoApproveRuleMutation,
  useUpdateAutoApproveRuleMutation,
  useDeleteAutoApproveRuleMutation,
} from '../hooks/useImports';
import { AutoApproveRule } from '../types/import';
import { TransactionType } from '../types';
import { TRANSACTION_TYPES } from '@/shared/types/transaction';
import { isOneOf } from '@/utils/oneOf';
import { useT } from '@/i18n/useT';

type RuleFormState = {
  descriptionPattern: string;
  categoryId: string;
  type: TransactionType;
};

const emptyForm: RuleFormState = {
  descriptionPattern: '',
  categoryId: '',
  type: 'EXPENSE',
};

export default function AutoApproveRuleManager() {
  const t = useT();
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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          p: 2,
        }}
      >
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h6">{t('settings.rules.title')}</Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          {t('settings.rules.add')}
        </Button>
      </Box>

      {rules.length === 0 ? (
        <Typography
          align="center"
          sx={{
            color: 'text.secondary',
            py: 2,
          }}
        >
          {t('settings.rules.empty')}
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('settings.rules.column.pattern')}</TableCell>
              <TableCell>{t('common.category')}</TableCell>
              <TableCell>{t('common.type')}</TableCell>
              <TableCell>{t('settings.rules.column.active')}</TableCell>
              <TableCell>{t('settings.rules.column.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>{rule.descriptionPattern}</TableCell>
                <TableCell>{rule.category?.name || rule.categoryId}</TableCell>
                <TableCell>
                  {rule.type === 'INCOME'
                    ? t('common.income')
                    : t('common.expense')}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={rule.isActive}
                    onChange={() => handleToggle(rule)}
                    size="small"
                    slotProps={{
                      input: {
                        'aria-label': t('settings.rules.toggleFor', {
                          pattern: rule.descriptionPattern,
                        }),
                      },
                    }}
                  />
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleOpen(rule)}
                    aria-label={t('settings.rules.editFor', {
                      pattern: rule.descriptionPattern,
                    })}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(rule.id)}
                    aria-label={t('settings.rules.deleteFor', {
                      pattern: rule.descriptionPattern,
                    })}
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
          {editingRule
            ? t('settings.rules.editTitle')
            : t('settings.rules.createTitle')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={t('settings.rules.pattern')}
              value={form.descriptionPattern}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  descriptionPattern: e.target.value,
                }))
              }
              placeholder={t('settings.rules.patternPlaceholder')}
              fullWidth
              required
            />
            <CategorySelect
              value={form.categoryId}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, categoryId: value }))
              }
              required
            />
            <TextField
              select
              label={t('common.type')}
              value={form.type}
              onChange={(e) => {
                const type = e.target.value;
                if (isOneOf(TRANSACTION_TYPES, type)) {
                  setForm((prev) => ({ ...prev, type }));
                }
              }}
              fullWidth
              required
            >
              <MenuItem value="EXPENSE">{t('common.expense')}</MenuItem>
              <MenuItem value="INCOME">{t('common.income')}</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t('common.cancel')}</Button>
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
            {editingRule
              ? t('settings.rules.update')
              : t('settings.rules.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
