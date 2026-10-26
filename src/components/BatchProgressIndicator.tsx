'use client';

import React, { useState } from 'react';
import {
  Alert,
  Box,
  Collapse,
  IconButton,
  LinearProgress,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import { useT } from '@/i18n/useT';
import type { T } from '@/i18n/useT.types';
import { BatchResult } from '../types/import';

type BatchItemKind = 'transactions' | 'files';

type BatchProgressIndicatorProps = {
  result: BatchResult | null;
  isLoading: boolean;
  onClose: () => void;
  itemKind?: BatchItemKind;
};

export default function BatchProgressIndicator({
  result,
  isLoading,
  onClose,
  itemKind = 'transactions',
}: BatchProgressIndicatorProps) {
  const t = useT();
  const [showErrors, setShowErrors] = useState(false);

  if (isLoading) {
    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {t('imports.batch.inProgress')}
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (!result) {
    return null;
  }

  const severity =
    result.failed === 0
      ? 'success'
      : result.succeeded === 0
        ? 'error'
        : 'warning';

  return (
    <Box sx={{ mb: 2 }}>
      <Alert
        severity={severity}
        action={
          <IconButton
            size="small"
            onClick={onClose}
            aria-label={t('imports.batch.dismiss')}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      >
        <Typography variant="body2">
          {resultSummary({ result, itemKind, t })}
        </Typography>
        {result.errors.length > 0 && (
          <>
            <IconButton
              size="small"
              onClick={() => setShowErrors(!showErrors)}
              aria-label={t('imports.batch.toggleErrors')}
              aria-expanded={showErrors}
              sx={{ ml: 1 }}
            >
              <ExpandMoreIcon
                sx={{
                  transform: showErrors ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}
              />
            </IconButton>
            <Collapse in={showErrors}>
              <Box sx={{ mt: 1 }}>
                {result.errors.map((batchError, index) => (
                  <Typography
                    key={index}
                    variant="caption"
                    sx={{
                      display: 'block',
                    }}
                  >
                    {batchError.id}: {batchError.error}
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

function resultSummary({
  result,
  itemKind,
  t,
}: {
  result: BatchResult;
  itemKind: BatchItemKind;
  t: T;
}): string {
  const counts = { succeeded: result.succeeded, total: result.total };
  const processed =
    itemKind === 'files'
      ? t('imports.batch.filesResult', counts)
      : t('imports.batch.transactionsResult', counts);
  if (result.failed === 0) {
    return processed;
  }
  return `${processed} ${t('imports.batch.failedCount', { count: result.failed })}`;
}
