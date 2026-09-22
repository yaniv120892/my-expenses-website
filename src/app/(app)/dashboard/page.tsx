'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
  useDashboardQuery,
  useDashboardInsightsQuery,
} from '@/hooks/useDashboardQuery';
import { useCreateTransactionMutation } from '@/hooks/useTransactionsQuery';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { MonthComparisonCards } from '@/components/dashboard/MonthComparisonCards';
import { TopCategoriesChart } from '@/components/dashboard/TopCategoriesChart';
import { MonthHighlights } from '@/components/dashboard/MonthHighlights';
import { AiInsightsCard } from '@/components/dashboard/AiInsightsCard';
import { RecentTransactionsQuickView } from '@/components/dashboard/RecentTransactionsQuickView';
import { SubscriptionsCard } from '@/components/dashboard/SubscriptionsCard';
import TransactionForm from '@/components/TransactionForm';
import PageHeader from '@/components/shell/PageHeader';
import { CreateTransactionInput } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading, error: dashboardError } = useDashboardQuery();
  const { data: insights, isLoading: insightsLoading } =
    useDashboardInsightsQuery(!!data);
  const createMutation = useCreateTransactionMutation();

  // Must not catch: the form reports the outcome (see CLAUDE.md).
  const handleCreate = async (input: CreateTransactionInput) => {
    const result = await createMutation.mutateAsync(input);
    return result.id;
  };

  const header = (
    <PageHeader
      title="Dashboard"
      action={
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setFormOpen(true)}
        >
          Add transaction
        </Button>
      }
    />
  );

  if (isLoading) {
    return (
      <>
        {header}
        <DashboardSkeleton />
      </>
    );
  }

  if (dashboardError || !data) {
    return (
      <>
        {header}
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="error">Failed to load dashboard</Typography>
          <Button onClick={() => window.location.reload()} sx={{ mt: 2 }}>
            Retry
          </Button>
        </Box>
      </>
    );
  }

  return (
    <>
      {header}

      <MonthComparisonCards comparison={data.monthComparison} />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
          gap: { xs: 2, md: 3 },
          mt: { xs: 2, md: 3 },
        }}
      >
        <TopCategoriesChart
          categories={data.topCategories}
          // Expenses only, to match how the slices are aggregated.
          onSelectCategory={(categoryId) =>
            router.push(`/transactions?categoryId=${categoryId}&type=EXPENSE`)
          }
        />
        <AiInsightsCard insights={insights} isLoading={insightsLoading} />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: { xs: 2, md: 3 },
          mt: { xs: 2, md: 3 },
        }}
      >
        <MonthHighlights
          comparison={data.monthComparison}
          categories={data.topCategories}
        />
        <RecentTransactionsQuickView
          transactions={data.recentTransactions}
          onViewAll={() => router.push('/transactions')}
        />
      </Box>

      <Box sx={{ mt: { xs: 2, md: 3 } }}>
        <SubscriptionsCard
          subscriptions={data.subscriptions}
          onViewAll={() => router.push('/subscriptions')}
        />
      </Box>

      <TransactionForm
        open={formOpen}
        onCloseAction={() => setFormOpen(false)}
        onSubmitAction={handleCreate}
        initialData={null}
      />
    </>
  );
}
