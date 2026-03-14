"use client";

import React, { useState } from "react";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Alert,
  Skeleton,
  Paper,
} from "@mui/material";
import {
  useSubscriptionsQuery,
  useConfirmSubscriptionMutation,
  useDismissSubscriptionMutation,
  useConvertSubscriptionMutation,
} from "@/hooks/useSubscriptionsQuery";
import SubscriptionCard from "@/components/subscriptions/SubscriptionCard";
import ConvertToScheduledDialog from "@/components/subscriptions/ConvertToScheduledDialog";
import { DetectedSubscription, SubscriptionStatus } from "@/types/subscription";

type FilterTab = "ALL" | SubscriptionStatus;

export default function SubscriptionsTab() {
  const [filterTab, setFilterTab] = useState<FilterTab>("ALL");
  const [convertTarget, setConvertTarget] =
    useState<DetectedSubscription | null>(null);

  const statusParam = filterTab === "ALL" ? undefined : filterTab;
  const { data, isLoading, error } = useSubscriptionsQuery(statusParam);
  const confirmMutation = useConfirmSubscriptionMutation();
  const dismissMutation = useDismissSubscriptionMutation();
  const convertMutation = useConvertSubscriptionMutation();

  function handleConvert(id: string, categoryId: string) {
    convertMutation.mutate(
      { id, categoryId },
      { onSuccess: () => setConvertTarget(null) }
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {error instanceof Error ? error.message : "Failed to load subscriptions"}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
        Subscriptions
      </Typography>

      {isLoading ? (
        <Box>
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              variant="rounded"
              height={120}
              sx={{ mb: 2, borderRadius: 2 }}
            />
          ))}
        </Box>
      ) : (
        data && (
          <>
            <Paper
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: { xs: 1.5, md: 3 },
                p: 2,
                mb: 3,
                borderRadius: 2,
                boxShadow: 2,
              }}
            >
              <Box sx={{ minWidth: 80 }}>
                <Typography variant="body2" color="text.secondary">
                  Active
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {data.activeCount}
                </Typography>
              </Box>
              <Box sx={{ minWidth: 80 }}>
                <Typography variant="body2" color="text.secondary">
                  Detected
                </Typography>
                <Typography variant="h5" fontWeight={700} color="warning.main">
                  {data.detectedCount}
                </Typography>
              </Box>
              <Box sx={{ minWidth: 80 }}>
                <Typography variant="body2" color="text.secondary">
                  Monthly
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  ${data.totalMonthlyEstimate.toFixed(0)}
                </Typography>
              </Box>
              <Box sx={{ minWidth: 80 }}>
                <Typography variant="body2" color="text.secondary">
                  Annual
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  ${data.totalAnnualEstimate.toFixed(0)}
                </Typography>
              </Box>
            </Paper>

            <Tabs
              value={filterTab}
              onChange={(_, v) => setFilterTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ mb: 2 }}
            >
              <Tab label="All" value="ALL" />
              <Tab label="Detected" value="DETECTED" />
              <Tab label="Confirmed" value="CONFIRMED" />
              <Tab label="Dismissed" value="DISMISSED" />
            </Tabs>

            {data.subscriptions.length === 0 ? (
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ textAlign: "center", py: 4 }}
              >
                No subscriptions found
              </Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
        )
      )}
    </Box>
  );
}
