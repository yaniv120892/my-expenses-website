"use client";

import React, { useState } from "react";
import { Box, Typography, Button, Fab, Alert, Snackbar } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import {
  useDashboardQuery,
  useDashboardInsightsQuery,
} from "@/hooks/useDashboardQuery";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useCreateTransactionMutation } from "@/hooks/useTransactionsQuery";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { MonthComparisonCards } from "@/components/dashboard/MonthComparisonCards";
import { TopCategoriesChart } from "@/components/dashboard/TopCategoriesChart";
import { MonthHighlights } from "@/components/dashboard/MonthHighlights";
import { AiInsightsCard } from "@/components/dashboard/AiInsightsCard";
import { RecentTransactionsQuickView } from "@/components/dashboard/RecentTransactionsQuickView";
import { SubscriptionsCard } from "@/components/dashboard/SubscriptionsCard";
import TransactionForm from "@/components/TransactionForm";
import { CreateTransactionInput } from "@/types";

interface DashboardTabProps {
  onNavigateToTransactions: () => void;
  onNavigateToSubscriptions: () => void;
}

export default function DashboardTab({
  onNavigateToTransactions,
  onNavigateToSubscriptions,
}: DashboardTabProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: dashboardError } = useDashboardQuery();
  const { data: insights, isLoading: insightsLoading } =
    useDashboardInsightsQuery(!!data);
  const isMobile = useIsMobile();
  const createMutation = useCreateTransactionMutation();

  const handleCreateSuccess = async (data: CreateTransactionInput) => {
    try {
      const result = await createMutation.mutateAsync(data);
      return result.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create transaction");
    }
  };

  if (isLoading) return <DashboardSkeleton />;
  if (dashboardError || !data) {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <Typography color="error">Failed to load dashboard</Typography>
        <Button onClick={() => window.location.reload()} sx={{ mt: 2 }}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      <MonthComparisonCards comparison={data.monthComparison} />

      <Box
        sx={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: 3,
          mt: 3,
        }}
      >
        <Box sx={{ flex: 2 }}>
          <TopCategoriesChart categories={data.topCategories} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <AiInsightsCard insights={insights} isLoading={insightsLoading} />
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: 3,
          mt: 3,
        }}
      >
        <Box sx={{ flex: 1 }}>
          <MonthHighlights
            comparison={data.monthComparison}
            categories={data.topCategories}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <RecentTransactionsQuickView
            transactions={data.recentTransactions}
            onViewAll={onNavigateToTransactions}
          />
        </Box>
      </Box>

      <Box sx={{ mt: 3 }}>
        <SubscriptionsCard
          subscriptions={data.subscriptions}
          onViewAll={onNavigateToSubscriptions}
        />
      </Box>

      <TransactionForm
        open={formOpen}
        onCloseAction={() => setFormOpen(false)}
        onSubmitAction={handleCreateSuccess}
        initialData={null}
      />

      {!formOpen && (
        <Box
          sx={{
            position: "fixed",
            bottom: 32,
            right: 32,
            zIndex: 2000,
          }}
        >
          <Fab
            color="secondary"
            aria-label="add"
            onClick={() => setFormOpen(true)}
          >
            <AddIcon />
          </Fab>
        </Box>
      )}

      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={() => setError(null)}
      >
        <Alert severity="error">{error}</Alert>
      </Snackbar>
    </Box>
  );
}
