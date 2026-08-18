'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import PageHeader from '@/components/shell/PageHeader';
import EmptyState from '@/components/EmptyState';
import SubscriptionCard from '@/components/subscriptions/SubscriptionCard';
import ConvertToScheduledDialog from '@/components/subscriptions/ConvertToScheduledDialog';
import EditSubscriptionDialog from '@/components/subscriptions/EditSubscriptionDialog';
import SubscriptionEvidenceDialog from '@/components/subscriptions/SubscriptionEvidenceDialog';
import {
  useSubscriptionsQuery,
  useConfirmSubscriptionMutation,
  useDismissSubscriptionMutation,
  useConvertSubscriptionMutation,
  useUpdateSubscriptionMutation,
} from '@/hooks/useSubscriptionsQuery';
import {
  DetectedSubscription,
  SubscriptionStatus,
  UpdateSubscriptionPayload,
} from '@/types/subscription';
import { formatCurrencyRounded } from '@/utils/format';
import {
  SUBSCRIPTION_SORT_OPTIONS,
  SubscriptionSortKey,
  sortSubscriptions,
} from '@/utils/subscriptionSort';

type FilterTab = 'ALL' | SubscriptionStatus;

const KPI_GRID_COLUMNS = { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' };

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
  const [sortKey, setSortKey] = useState<SubscriptionSortKey>('MONTHLY_DESC');
  const [convertTarget, setConvertTarget] =
    useState<DetectedSubscription | null>(null);
  const [editTarget, setEditTarget] = useState<DetectedSubscription | null>(
    null,
  );
  const [explainTarget, setExplainTarget] =
    useState<DetectedSubscription | null>(null);

  const statusParam = filterTab === 'ALL' ? undefined : filterTab;
  const { data, isLoading, error } = useSubscriptionsQuery(statusParam);
  const confirmMutation = useConfirmSubscriptionMutation();
  const dismissMutation = useDismissSubscriptionMutation();
  const convertMutation = useConvertSubscriptionMutation();
  const updateMutation = useUpdateSubscriptionMutation();

  const sortedSubscriptions = useMemo(
    () => sortSubscriptions(data?.subscriptions ?? [], sortKey),
    [data?.subscriptions, sortKey],
  );

  function handleConvert(id: string, categoryId: string) {
    convertMutation.mutate(
      { id, categoryId },
      { onSuccess: () => setConvertTarget(null) },
    );
  }

  function handleSave(id: string, payload: UpdateSubscriptionPayload) {
    updateMutation.mutate(
      { id, payload },
      { onSuccess: () => setEditTarget(null) },
    );
  }

  function handleCloseEdit() {
    updateMutation.reset();
    setEditTarget(null);
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
              gridTemplateColumns: KPI_GRID_COLUMNS,
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
              gridTemplateColumns: KPI_GRID_COLUMNS,
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

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ md: 'flex-end' }}
            justifyContent="space-between"
            sx={{ mb: 2 }}
          >
            <Tabs
              value={filterTab}
              onChange={(_, v) => setFilterTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{ borderBottom: 1, borderColor: 'divider', flexGrow: 1 }}
            >
              <Tab label="All" value="ALL" />
              <Tab label="Detected" value="DETECTED" />
              <Tab label="Confirmed" value="CONFIRMED" />
              <Tab label="Dismissed" value="DISMISSED" />
            </Tabs>
            <TextField
              select
              size="small"
              label="Sort by"
              value={sortKey}
              onChange={(e) =>
                setSortKey(e.target.value as SubscriptionSortKey)
              }
              sx={{ minWidth: { xs: '100%', md: 260 } }}
            >
              {SUBSCRIPTION_SORT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {sortedSubscriptions.length === 0 ? (
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
              {sortedSubscriptions.map((sub) => (
                <SubscriptionCard
                  key={sub.id}
                  subscription={sub}
                  onConfirm={(id) => confirmMutation.mutate(id)}
                  onDismiss={(id) => dismissMutation.mutate(id)}
                  onConvert={setConvertTarget}
                  onEdit={setEditTarget}
                  onExplain={setExplainTarget}
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

          <EditSubscriptionDialog
            open={!!editTarget}
            subscription={editTarget}
            onClose={handleCloseEdit}
            onSave={handleSave}
            isLoading={updateMutation.isPending}
            error={
              updateMutation.error instanceof Error
                ? updateMutation.error.message
                : undefined
            }
          />

          <SubscriptionEvidenceDialog
            open={!!explainTarget}
            subscription={explainTarget}
            onClose={() => setExplainTarget(null)}
          />
        </>
      )}
    </>
  );
}
