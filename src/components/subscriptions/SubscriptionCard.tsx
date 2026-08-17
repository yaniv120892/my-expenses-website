'use client';

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Button,
  LinearProgress,
  Stack,
} from '@mui/material';
import { DetectedSubscription } from '@/types/subscription';
import { formatCurrency } from '@/utils/format';

interface Props {
  subscription: DetectedSubscription;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onConvert: (subscription: DetectedSubscription) => void;
}

function formatFrequency(frequency: string): string {
  switch (frequency) {
    case 'WEEKLY':
      return 'Weekly';
    case 'MONTHLY':
      return 'Monthly';
    case 'YEARLY':
      return 'Yearly';
    default:
      return frequency;
  }
}

function frequencyColor(
  frequency: string,
): 'primary' | 'secondary' | 'warning' {
  switch (frequency) {
    case 'WEEKLY':
      return 'warning';
    case 'MONTHLY':
      return 'primary';
    case 'YEARLY':
      return 'secondary';
    default:
      return 'primary';
  }
}

function statusColor(
  status: string,
): 'default' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'DETECTED':
      return 'warning';
    case 'CONFIRMED':
      return 'success';
    case 'DISMISSED':
      return 'default';
    default:
      return 'default';
  }
}

export default function SubscriptionCard({
  subscription,
  onConfirm,
  onDismiss,
  onConvert,
}: Props) {
  const nextDate = new Date(subscription.nextExpectedDate).toLocaleDateString();

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          '&:last-child': { pb: 2 },
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={1}
          sx={{ mb: 1 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {subscription.displayName}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <Chip
                label={formatFrequency(subscription.frequency)}
                color={frequencyColor(subscription.frequency)}
                size="small"
                variant="outlined"
              />
              <Chip
                label={subscription.status}
                color={statusColor(subscription.status)}
                size="small"
              />
            </Stack>
          </Box>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography variant="h6" fontWeight={700}>
              {formatCurrency(subscription.averageAmount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatCurrency(subscription.annualCost)}/yr
            </Typography>
          </Box>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Next expected: {nextDate}
        </Typography>

        {subscription.status === 'DETECTED' && (
          <Box sx={{ mb: 1.5 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              sx={{ mb: 0.5 }}
            >
              <Typography variant="caption" color="text.secondary">
                Confidence
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.round(subscription.confidence * 100)}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={subscription.confidence * 100}
              sx={{ borderRadius: 1, height: 6 }}
            />
          </Box>
        )}

        {subscription.status !== 'DISMISSED' && (
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            sx={{ mt: 'auto', pt: 1 }}
          >
            {subscription.status === 'DETECTED' && (
              <>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => onConfirm(subscription.id)}
                >
                  Confirm
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => onDismiss(subscription.id)}
                >
                  Dismiss
                </Button>
              </>
            )}
            {!subscription.scheduledTransactionId && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => onConvert(subscription)}
              >
                Convert to Scheduled
              </Button>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
