'use client';

import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useIsCompact } from '@/hooks/useBreakpoints';
import { DetectedSubscription } from '@/types/subscription';
import { formatCurrency } from '@/utils/format';
import { formatDateRange, formatDay } from '@/utils/dateUtils';
import {
  buildEvidenceReasons,
  withChargeGaps,
} from '@/utils/subscriptionEvidence';

interface Props {
  open: boolean;
  subscription: DetectedSubscription | null;
  onClose: () => void;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Box>
  );
}

export default function SubscriptionEvidenceDialog({
  open,
  subscription,
  onClose,
}: Props) {
  const fullScreen = useIsCompact();
  const evidence = subscription?.detectionEvidence;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
    >
      <DialogTitle>Why {subscription?.displayName} was detected</DialogTitle>
      <DialogContent>
        {subscription &&
          (!evidence ? (
            <Alert severity="info">
              This subscription was found before detection started recording its
              reasoning. The details will appear after the next weekly detection
              run.
            </Alert>
          ) : (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Box>
                {buildEvidenceReasons(subscription, evidence).map((reason) => (
                  <Typography key={reason} variant="body2" sx={{ mb: 0.75 }}>
                    • {reason}
                  </Typography>
                ))}
              </Box>

              <Divider />

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, 1fr)' },
                  gap: 2,
                }}
              >
                <Fact
                  label="Typical gap"
                  value={`${evidence.medianIntervalDays} days`}
                />
                <Fact
                  label="Gap range"
                  value={`${evidence.minIntervalDays}–${evidence.maxIntervalDays} days`}
                />
                <Fact
                  label="Amount range"
                  value={
                    evidence.minAmount === evidence.maxAmount
                      ? `${formatCurrency(evidence.minAmount)} every time`
                      : `${formatCurrency(evidence.minAmount)} – ${formatCurrency(evidence.maxAmount)}`
                  }
                />
                <Fact
                  label="Charges matched"
                  value={`${evidence.chargeCount}`}
                />
                <Fact
                  label="Window analyzed"
                  value={formatDateRange(
                    evidence.analyzedFrom,
                    evidence.analyzedTo,
                    '→',
                  )}
                />
                <Fact label="Merchant key" value={subscription.merchantName} />
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Matching descriptions
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {subscription.matchingDescriptions.map((description) => (
                    <Chip key={description} label={description} size="small" />
                  ))}
                </Stack>
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Charges behind this
                </Typography>
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="right">Gap</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {withChargeGaps(evidence.recentCharges).map(
                        (charge, index) => (
                          <TableRow key={`${charge.date}-${index}`}>
                            <TableCell>{formatDay(charge.date)}</TableCell>
                            <TableCell>{charge.description}</TableCell>
                            <TableCell align="right">
                              {formatCurrency(charge.amount)}
                            </TableCell>
                            <TableCell align="right">
                              {charge.gapDays === null
                                ? '—'
                                : `${charge.gapDays}d`}
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                </Box>
                {evidence.olderChargeCount > 0 && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, display: 'block' }}
                  >
                    {evidence.olderChargeCount} older charge
                    {evidence.olderChargeCount > 1 ? 's' : ''} also matched.
                  </Typography>
                )}
              </Box>

              {subscription.userEditedAt && (
                <Alert severity="info">
                  You edited these figures on{' '}
                  {formatDay(subscription.userEditedAt)}. Detection keeps
                  refreshing the charges above but no longer overwrites your
                  amount, frequency or name.
                </Alert>
              )}
            </Stack>
          ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
