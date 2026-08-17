'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Paper,
  Skeleton,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import PageHeader from '@/components/shell/PageHeader';
import EmptyState from '@/components/EmptyState';
import SubscriptionCard from '@/components/subscriptions/SubscriptionCard';
import ConvertToScheduledDialog from '@/components/subscriptions/ConvertToScheduledDialog';
import {
  useSubscriptionsQuery,
  useConfirmSubscriptionMutation,
  useDismissSubscriptionMutation,
  useConvertSubscriptionMutation,
} from '@/hooks/useSubscriptionsQuery';
import { DetectedSubscription, SubscriptionStatus } from '@/types/subscription';
import { formatCurrencyRounded } from '@/utils/format';

type FilterTab = 'ALL' | SubscriptionStatus;

function StatTile({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h3" sx={{ mt: 0.5, color: valueColor }}>
        {value}
      </Typography>
    </Paper>
  );
}

export default function SubscriptionsPage() {
  const [filterTab, setFilterTab] = useState<FilterTab>('ALL');
  const [convertTarget, setConvertTarget] =
    useState<DetectedSubscription | null>(null);

  const statusParam = filterTab === 'ALL' ? undefined : filterTab;
  const { data, isLoading, error } = useSubscriptionsQuery(statusParam);
  const confirmMutation = useConfirmSubscriptionMutation();
  const dismissMutation = useDismissSubscriptionMutation();
  const convertMutation = useConvertSubscriptionMutation();

  function handleConvert(id: string, categoryId: string) {
    convertMutation.mutate(
      { id, categoryId },
      { onSuccess: () => setConvertTarget(null) },
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Subscriptions" />
        <Alert severity="error">
          {error instanceof Error
            ? error.message
            : 'Failed to load subscriptions'}
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Subscriptions"
        subtitle="Recurring charges detected from your transactions"
      />

      {isLoading || !data ? (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(4, 1fr)',
              },
              gap: 2,
            }}
          >
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="rounded" height={84} />
            ))}
          </Box>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={140} />
          ))}
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(4, 1fr)',
              },
              gap: 2,
              mb: 3,
            }}
          >
            <StatTile label="Active" value={String(data.activeCount)} />
            <StatTile
              label="Detected"
              value={String(data.detectedCount)}
              valueColor="warning.main"
            />
            <StatTile
              label="Monthly"
              value={formatCurrencyRounded(data.totalMonthlyEstimate)}
            />
            <StatTile
              label="Annual"
              value={formatCurrencyRounded(data.totalAnnualEstimate)}
            />
          </Box>

          <Tabs
            value={filterTab}
            onChange={(_, v) => setFilterTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="All" value="ALL" />
            <Tab label="Detected" value="DETECTED" />
            <Tab label="Confirmed" value="CONFIRMED" />
            <Tab label="Dismissed" value="DISMISSED" />
          </Tabs>

          {data.subscriptions.length === 0 ? (
            <EmptyState message="No subscriptions found" />
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  lg: 'repeat(3, 1fr)',
                },
                gap: 2,
              }}
            >
              {data.subscriptions.map((sub) => (
                <SubscriptionCard
                  key={sub.id}
                  subscription={sub}
                  onConfirm={(id) => confirmMutation.mutate(id)}
                  onDismiss={(id) => dismissMutation.mutate(id)}
                  onConvert={setConvertTarget}
                />
              ))}
            </Box>
          )}

          <ConvertToScheduledDialog
            open={!!convertTarget}
            subscription={convertTarget}
            onClose={() => setConvertTarget(null)}
            onConvert={handleConvert}
            isLoading={convertMutation.isPending}
          />
        </>
      )}
    </>
  );
}
