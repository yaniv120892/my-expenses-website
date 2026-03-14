"use client";

import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Badge,
} from "@mui/material";
import RepeatIcon from "@mui/icons-material/Repeat";
import { SubscriptionSnapshot } from "@/types/dashboard";

interface Props {
  subscriptions: SubscriptionSnapshot | undefined;
  onViewAll: () => void;
}

export function SubscriptionsCard({ subscriptions, onViewAll }: Props) {
  if (!subscriptions) return null;

  const { activeCount, totalMonthlyEstimate, totalAnnualEstimate, detectedCount } = subscriptions;

  return (
    <Card
      sx={{
        borderRadius: 3,
        bgcolor: "background.default",
        boxShadow: 3,
        height: "100%",
      }}
    >
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <RepeatIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>
            Subscriptions
          </Typography>
          {detectedCount > 0 && (
            <Badge badgeContent={detectedCount} color="error" sx={{ ml: 1 }}>
              <Typography variant="caption" color="text.secondary">
                new
              </Typography>
            </Badge>
          )}
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: { xs: 1.5, md: 3 }, mb: 2 }}>
          <Box sx={{ minWidth: 80 }}>
            <Typography variant="body2" color="text.secondary">
              Active
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {activeCount}
            </Typography>
          </Box>
          <Box sx={{ minWidth: 80 }}>
            <Typography variant="body2" color="text.secondary">
              Monthly
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              ${totalMonthlyEstimate.toFixed(0)}
            </Typography>
          </Box>
          <Box sx={{ minWidth: 80 }}>
            <Typography variant="body2" color="text.secondary">
              Annual
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              ${totalAnnualEstimate.toFixed(0)}
            </Typography>
          </Box>
        </Box>

        <Button variant="outlined" size="small" onClick={onViewAll} fullWidth>
          View all subscriptions
        </Button>
      </CardContent>
    </Card>
  );
}
