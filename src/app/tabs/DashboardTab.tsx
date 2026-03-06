"use client";

import React from "react";
import { Box, Typography, Button } from "@mui/material";
import {
  useDashboardQuery,
  useDashboardInsightsQuery,
} from "@/hooks/useDashboardQuery";
import { useIsMobile } from "@/hooks/useIsMobile";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { MonthComparisonCards } from "@/components/dashboard/MonthComparisonCards";
import { TopCategoriesChart } from "@/components/dashboard/TopCategoriesChart";
import { MonthHighlights } from "@/components/dashboard/MonthHighlights";
import { AiInsightsCard } from "@/components/dashboard/AiInsightsCard";
import { RecentTransactionsQuickView } from "@/components/dashboard/RecentTransactionsQuickView";

interface DashboardTabProps {
  onNavigateToTransactions: () => void;
}

export default function DashboardTab({
  onNavigateToTransactions,
}: DashboardTabProps) {
  const { data, isLoading, error } = useDashboardQuery();
  const { data: insights, isLoading: insightsLoading } =
    useDashboardInsightsQuery(!!data);
  const isMobile = useIsMobile();

  if (isLoading) return <DashboardSkeleton />;
  if (error || !data) {
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
    </Box>
  );
}
