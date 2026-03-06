"use client";

import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
} from "@mui/material";
import { MonthComparison, TopCategory } from "@/types/dashboard";
import { formatNumber } from "@/utils/format";
import { COLORS } from "@/utils/constants";

interface Props {
  comparison: MonthComparison;
  categories: TopCategory[];
}

export function MonthHighlights({ comparison, categories }: Props) {
  const { currentMonth, previousMonth } = comparison;
  const maxExpense = Math.max(
    currentMonth.totalExpense,
    previousMonth.totalExpense,
    1
  );

  // Find biggest category increase/decrease
  const sortedByChange = [...categories].sort(
    (a, b) => b.change.percentage - a.change.percentage
  );
  const biggestIncrease = sortedByChange.find(
    (c) => c.change.trend === "up"
  );
  const biggestDecrease = [...sortedByChange]
    .reverse()
    .find((c) => c.change.trend === "down");

  return (
    <Card
      sx={{
        borderRadius: 3,
        bgcolor: "var(--background)",
        boxShadow: 3,
        height: "100%",
      }}
    >
      <CardContent>
        <Typography variant="h6" fontWeight={700} color={COLORS.text} mb={2}>
          Month Highlights
        </Typography>

        <Typography variant="body2" sx={{ color: "var(--text-secondary)", mb: 0.5 }}>
          Spending Comparison
        </Typography>
        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              mb: 0.5,
            }}
          >
            <Typography variant="body2" color={COLORS.text}>
              This Month
            </Typography>
            <Typography variant="body2" fontWeight={600} color={COLORS.text}>
              {formatNumber(currentMonth.totalExpense)}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(currentMonth.totalExpense / maxExpense) * 100}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: "var(--secondary-light)",
              "& .MuiLinearProgress-bar": {
                bgcolor: COLORS.expense,
                borderRadius: 4,
              },
            }}
          />
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              mt: 1,
              mb: 0.5,
            }}
          >
            <Typography variant="body2" color={COLORS.text}>
              Last Month
            </Typography>
            <Typography variant="body2" fontWeight={600} color={COLORS.text}>
              {formatNumber(previousMonth.totalExpense)}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(previousMonth.totalExpense / maxExpense) * 100}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: "var(--secondary-light)",
              "& .MuiLinearProgress-bar": {
                bgcolor: COLORS.purple,
                borderRadius: 4,
              },
            }}
          />
        </Box>

        {biggestIncrease && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>
              Biggest Increase
            </Typography>
            <Typography
              variant="body2"
              fontWeight={600}
              color={COLORS.expense}
            >
              {biggestIncrease.categoryName}: +
              {Math.abs(biggestIncrease.change.percentage).toFixed(1)}%
            </Typography>
          </Box>
        )}

        {biggestDecrease && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>
              Biggest Decrease
            </Typography>
            <Typography
              variant="body2"
              fontWeight={600}
              color={COLORS.income}
            >
              {biggestDecrease.categoryName}:{" "}
              {biggestDecrease.change.percentage.toFixed(1)}%
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
