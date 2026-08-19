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
  Tooltip,
} from '@mui/material';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import { DetectedSubscription } from '@/types/subscription';
import { formatCurrency, formatSubscriptionFrequency } from '@/utils/format';

interface Props {
  subscription: DetectedSubscription;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onConvert: (subscription: DetectedSubscription) => void;
  onEdit: (subscription: DetectedSubscription) => void;
  onExplain: (subscription: DetectedSubscription) => void;
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
  onEdit,
  onExplain,
}: Props) {
  const nextDate = new Date(subscription.nextExpectedDate).toLocaleDateString();
  const scheduleMatch = subscription.scheduleMatch;

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
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              sx={{ mt: 0.5 }}
            >
              <Chip
                label={formatSubscriptionFrequency(subscription.frequency)}
                color={frequencyColor(subscription.frequency)}
                size="small"
                variant="outlined"
              />
              <Chip
                label={subscription.status}
                color={statusColor(subscription.status)}
                size="small"
              />
              <Chip
                label={subscription.categoryName ?? 'No category'}
                size="small"
                variant="outlined"
                color={subscription.categoryName ? 'default' : 'warning'}
              />
              {subscription.userEditedAt && (
                <Tooltip title="You edited these figures; detection no longer overwrites them">
                  <Chip label="Edited" size="small" variant="outlined" />
                </Tooltip>
              )}
            </Stack>
          </Box>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography variant="h6" fontWeight={700}>
              {formatCurrency(subscription.averageAmount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatCurrency(subscription.monthlyCost)}/mo ·{' '}
              {formatCurrency(subscription.annualCost)}/yr
            </Typography>
          </Box>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Next expected: {nextDate}
        </Typography>

        {scheduleMatch && (
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ mb: 1, color: 'success.main' }}
          >
            <EventRepeatIcon fontSize="small" />
            <Typography variant="body2">
              {scheduleMatch.matchType === 'LINKED'
                ? 'Already scheduled'
                : `Looks scheduled already as "${scheduleMatch.description}"`}
            </Typography>
          </Stack>
        )}

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
          <Button
            variant="outlined"
            size="small"
            onClick={() => onEdit(subscription)}
          >
            Edit
          </Button>
          <Button size="small" onClick={() => onExplain(subscription)}>
            Why detected?
          </Button>
          {subscription.status !== 'DISMISSED' && !scheduleMatch && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => onConvert(subscription)}
            >
              Convert to Scheduled
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
