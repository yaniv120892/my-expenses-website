"use client";

import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { MonthComparison, PercentageChange } from "@/types/dashboard";
import { TrendIcon } from "@/components/trends/TrendIcon";
import { formatNumber } from "@/utils/format";
import { COLORS } from "@/utils/constants";

interface Props {
  comparison: MonthComparison;
}

function getChangeColor(
  change: PercentageChange,
  invertColors: boolean
): string {
  if (change.trend === "stable") return COLORS.text;
  if (invertColors) {
    return change.trend === "up" ? COLORS.expense : COLORS.income;
  }
  return change.trend === "up" ? COLORS.income : COLORS.expense;
}

function ComparisonCard({
  title,
  value,
  change,
  invertColors = false,
}: {
  title: string;
  value: number;
  change: PercentageChange;
  invertColors?: boolean;
}) {
  const color = getChangeColor(change, invertColors);

  return (
    <Card
      sx={{
        flex: 1,
        minWidth: 200,
        borderRadius: 3,
        bgcolor: "var(--background)",
        boxShadow: 3,
      }}
    >
      <CardContent>
        <Typography variant="body2" sx={{ color: "var(--text-secondary)" }} gutterBottom>
          {title}
        </Typography>
        <Typography variant="h5" fontWeight={700} color={COLORS.text}>
          {formatNumber(value)}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1 }}>
          <TrendIcon trend={change.trend} />
          <Typography variant="body2" sx={{ color, fontWeight: 600 }}>
            {Math.abs(change.percentage).toFixed(1)}%
          </Typography>
          <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>
            vs last month
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export function MonthComparisonCards({ comparison }: Props) {
  return (
    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      <ComparisonCard
        title="Income"
        value={comparison.currentMonth.totalIncome}
        change={comparison.incomeChange}
      />
      <ComparisonCard
        title="Expenses"
        value={comparison.currentMonth.totalExpense}
        change={comparison.expenseChange}
        invertColors
      />
      <ComparisonCard
        title="Savings"
        value={comparison.currentMonth.savings}
        change={comparison.savingsChange}
      />
    </Box>
  );
}
