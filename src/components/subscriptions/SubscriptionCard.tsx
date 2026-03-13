"use client";

import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Button,
  LinearProgress,
} from "@mui/material";
import { DetectedSubscription } from "@/types/subscription";

interface Props {
  subscription: DetectedSubscription;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onConvert: (subscription: DetectedSubscription) => void;
}

function formatFrequency(frequency: string): string {
  switch (frequency) {
    case "WEEKLY":
      return "Weekly";
    case "MONTHLY":
      return "Monthly";
    case "YEARLY":
      return "Yearly";
    default:
      return frequency;
  }
}

function frequencyColor(
  frequency: string
): "primary" | "secondary" | "warning" {
  switch (frequency) {
    case "WEEKLY":
      return "warning";
    case "MONTHLY":
      return "primary";
    case "YEARLY":
      return "secondary";
    default:
      return "primary";
  }
}

function statusColor(
  status: string
): "default" | "success" | "warning" | "error" {
  switch (status) {
    case "DETECTED":
      return "warning";
    case "CONFIRMED":
      return "success";
    case "DISMISSED":
      return "default";
    default:
      return "default";
  }
}

export default function SubscriptionCard({
  subscription,
  onConfirm,
  onDismiss,
  onConvert,
}: Props) {
  const nextDate = new Date(subscription.nextExpectedDate).toLocaleDateString();

  return (
    <Card
      sx={{
        borderRadius: 2,
        boxShadow: 2,
        bgcolor: "background.paper",
      }}
    >
      <CardContent sx={{ pb: "16px !important" }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 1,
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {subscription.displayName}
            </Typography>
            <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
              <Chip
                label={formatFrequency(subscription.frequency)}
                color={frequencyColor(subscription.frequency)}
                size="small"
                variant="outlined"
              />
              <Chip
                label={subscription.status}
                color={statusColor(subscription.status)}
                size="small"
              />
            </Box>
          </Box>
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="h6" fontWeight={700}>
              ${subscription.averageAmount.toFixed(2)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ${subscription.annualCost.toFixed(2)}/yr
            </Typography>
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Next expected: {nextDate}
        </Typography>

        {subscription.status === "DETECTED" && (
          <Box sx={{ mb: 1.5 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                mb: 0.5,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Confidence
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.round(subscription.confidence * 100)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={subscription.confidence * 100}
              sx={{ borderRadius: 1, height: 6 }}
            />
          </Box>
        )}

        {subscription.status !== "DISMISSED" && (
          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            {subscription.status === "DETECTED" && (
              <>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  onClick={() => onConfirm(subscription.id)}
                >
                  Confirm
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => onDismiss(subscription.id)}
                >
                  Dismiss
                </Button>
              </>
            )}
            {!subscription.scheduledTransactionId && (
              <Button
                variant="outlined"
                color="primary"
                size="small"
                onClick={() => onConvert(subscription)}
              >
                Convert to Scheduled
              </Button>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
