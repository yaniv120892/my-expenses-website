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
import { PageHeader } from '@yaniv120892/my-ui';
import EmptyState from '@/components/EmptyState';
import NotificationSnackbar from '@/components/NotificationSnackbar';
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
import { describeApiError } from '@/utils/api';
import { useErrorNotice } from '@/hooks/useErrorNotice';
import { isOneOf } from '@/utils/oneOf';
import {
  SUBSCRIPTION_SORT_KEYS,
  SubscriptionSortKey,
  sortSubscriptions,
} from '@/utils/subscriptionSort';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';

type FilterTab = 'ALL' | SubscriptionStatus;

const STATUS_TABS: SubscriptionStatus[] = [
  'DETECTED',
  'CONFIRMED',
  'DISMISSED',
];

type DialogTarget = {
  kind: 'convert' | 'edit' | 'explain';
  subscription: DetectedSubscription;
};

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
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      <Typography variant="h3" sx={{ mt: 0.5, color: valueColor }}>
        {value}
      </Typography>
    </Paper>
  );
}

export default function SubscriptionsPage() {
  const t = useT();
  const formatter = useAppFormat();
  const [filterTab, setFilterTab] = useState<FilterTab>('ALL');
  const [sortKey, setSortKey] = useState<SubscriptionSortKey>('MONTHLY_DESC');
  const [dialog, setDialog] = useState<DialogTarget | null>(null);
  const { showError, snackbarProps } = useErrorNotice();

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

  function reportFailure(fallback: string) {
    return (error: unknown) => showError(describeApiError(error, fallback));
  }

  function handleConvert(id: string, categoryId: string) {
    convertMutation.mutate(
      { id, categoryId },
      {
        onSuccess: closeDialog,
        onError: reportFailure(t('subscriptions.convertFailed')),
      },
    );
  }

  function handleSave(id: string, payload: UpdateSubscriptionPayload) {
    updateMutation.mutate({ id, payload }, { onSuccess: closeDialog });
  }

  function closeDialog() {
    updateMutation.reset();
    setDialog(null);
  }

  if (error) {
    return (
      <>
        <PageHeader title={t('subscriptions.title')} />
        <Alert severity="error">
          {describeApiError(error, t('subscriptions.loadFailed'))}
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t('subscriptions.title')}
        subtitle={t('subscriptions.subtitle')}
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
            <StatTile
              label={t('subscriptions.stat.active')}
              value={formatter.number(data.activeCount)}
            />
            <StatTile
              label={t('subscriptions.stat.detected')}
              value={formatter.number(data.detectedCount)}
              valueColor="warning.main"
            />
            <StatTile
              label={t('subscriptions.stat.monthly')}
              value={formatter.currencyRounded(data.totalMonthlyEstimate)}
            />
            <StatTile
              label={t('subscriptions.stat.annual')}
              value={formatter.currencyRounded(data.totalAnnualEstimate)}
            />
          </Box>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{
              alignItems: { md: 'flex-end' },
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Tabs
              value={filterTab}
              onChange={(_, v) => setFilterTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{ borderBottom: 1, borderColor: 'divider', flexGrow: 1 }}
            >
              <Tab label={t('subscriptions.tab.ALL')} value="ALL" />
              {STATUS_TABS.map((status) => (
                <Tab
                  key={status}
                  label={t(`subscriptions.status.${status}`)}
                  value={status}
                />
              ))}
            </Tabs>
            <TextField
              select
              size="small"
              label={t('subscriptions.sortBy')}
              value={sortKey}
              onChange={(e) => {
                const selected = e.target.value;
                if (isOneOf(SUBSCRIPTION_SORT_KEYS, selected)) {
                  setSortKey(selected);
                }
              }}
              sx={{ minWidth: { xs: '100%', md: 260 } }}
            >
              {SUBSCRIPTION_SORT_KEYS.map((key) => (
                <MenuItem key={key} value={key}>
                  {t(`subscriptions.sort.${key}`)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {sortedSubscriptions.length === 0 ? (
            <EmptyState message={t('subscriptions.empty')} />
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
                  onConfirm={(id) =>
                    confirmMutation.mutate(id, {
                      onError: reportFailure(t('subscriptions.confirmFailed')),
                    })
                  }
                  onDismiss={(id) =>
                    dismissMutation.mutate(id, {
                      onError: reportFailure(t('subscriptions.dismissFailed')),
                    })
                  }
                  onConvert={(s) =>
                    setDialog({ kind: 'convert', subscription: s })
                  }
                  onEdit={(s) => setDialog({ kind: 'edit', subscription: s })}
                  onExplain={(s) =>
                    setDialog({ kind: 'explain', subscription: s })
                  }
                />
              ))}
            </Box>
          )}

          <ConvertToScheduledDialog
            open={dialog?.kind === 'convert'}
            subscription={dialog?.subscription ?? null}
            onClose={closeDialog}
            onConvert={handleConvert}
            isLoading={convertMutation.isPending}
          />

          <EditSubscriptionDialog
            open={dialog?.kind === 'edit'}
            subscription={dialog?.subscription ?? null}
            onClose={closeDialog}
            onSave={handleSave}
            isLoading={updateMutation.isPending}
            error={
              updateMutation.error instanceof Error
                ? updateMutation.error.message
                : undefined
            }
          />

          <SubscriptionEvidenceDialog
            open={dialog?.kind === 'explain'}
            subscription={dialog?.subscription ?? null}
            onClose={closeDialog}
          />
        </>
      )}

      <NotificationSnackbar {...snackbarProps} />
    </>
  );
}
