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
import type { DetectedSubscription } from '@/types/subscription';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import { buildEvidenceReasons, withChargeGaps } from '@/utils/subscriptionEvidence';

type Props = {
  open: boolean;
  subscription: DetectedSubscription | null;
  onClose: () => void;
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export default function SubscriptionEvidenceDialog({ open, subscription, onClose }: Props) {
  const t = useT();
  const formatter = useAppFormat();
  const fullScreen = useIsCompact();
  const evidence = subscription?.detectionEvidence;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
      <DialogTitle>
        {t('subscriptions.evidence.title', {
          name: subscription?.displayName ?? '',
        })}
      </DialogTitle>
      <DialogContent>
        {subscription &&
          (!evidence ? (
            <Alert severity="info">{t('subscriptions.evidence.noEvidence')}</Alert>
          ) : (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Box>
                {buildEvidenceReasons({
                  subscription,
                  evidence,
                  t,
                  formatter,
                }).map((reason) => (
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
                  label={t('subscriptions.evidence.typicalGap')}
                  value={t('subscriptions.evidence.days', {
                    count: evidence.medianIntervalDays,
                  })}
                />
                <Fact
                  label={t('subscriptions.evidence.gapRange')}
                  value={t('subscriptions.evidence.daysRange', {
                    min: evidence.minIntervalDays,
                    max: evidence.maxIntervalDays,
                  })}
                />
                <Fact
                  label={t('subscriptions.evidence.amountRange')}
                  value={
                    evidence.minAmount === evidence.maxAmount
                      ? t('subscriptions.evidence.sameAmount', {
                          amount: formatter.currency(evidence.minAmount),
                        })
                      : `${formatter.currency(evidence.minAmount)} – ${formatter.currency(evidence.maxAmount)}`
                  }
                />
                <Fact
                  label={t('subscriptions.evidence.chargesMatched')}
                  value={formatter.number({ value: evidence.chargeCount })}
                />
                <Fact
                  label={t('subscriptions.evidence.window')}
                  value={formatter.dateRange({
                    start: evidence.analyzedFrom,
                    end: evidence.analyzedTo,
                  })}
                />
                <Fact
                  label={t('subscriptions.evidence.merchantKey')}
                  value={subscription.merchantName}
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('subscriptions.evidence.matchingDescriptions')}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  sx={{
                    flexWrap: 'wrap',
                  }}
                >
                  {subscription.matchingDescriptions.map((description) => (
                    <Chip key={description} label={description} size="small" />
                  ))}
                </Stack>
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('subscriptions.evidence.charges')}
                </Typography>
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('subscriptions.evidence.column.date')}</TableCell>
                        <TableCell>{t('subscriptions.evidence.column.description')}</TableCell>
                        <TableCell align="right">
                          {t('subscriptions.evidence.column.amount')}
                        </TableCell>
                        <TableCell align="right">
                          {t('subscriptions.evidence.column.gap')}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {withChargeGaps(evidence.recentCharges).map((charge, index) => (
                        <TableRow key={`${charge.date}-${index}`}>
                          <TableCell>{formatter.day(charge.date)}</TableCell>
                          <TableCell>{charge.description}</TableCell>
                          <TableCell align="right">{formatter.currency(charge.amount)}</TableCell>
                          <TableCell align="right">
                            {charge.gapDays === null
                              ? '—'
                              : t('subscriptions.evidence.gapDays', {
                                  count: charge.gapDays,
                                })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
                {evidence.olderChargeCount > 0 && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      mt: 1,
                      display: 'block',
                    }}
                  >
                    {evidence.olderChargeCount === 1
                      ? t('subscriptions.evidence.olderCharges.one')
                      : t('subscriptions.evidence.olderCharges.other', {
                          count: evidence.olderChargeCount,
                        })}
                  </Typography>
                )}
              </Box>

              {subscription.userEditedAt && (
                <Alert severity="info">
                  {t('subscriptions.evidence.userEdited', {
                    date: formatter.day(subscription.userEditedAt),
                  })}
                </Alert>
              )}
            </Stack>
          ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
