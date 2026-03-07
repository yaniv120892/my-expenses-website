"use client";

import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { MonthComparison, PercentageChange } from "@/types/dashboard";
import { TrendIcon } from "@/components/trends/TrendIcon";
import { formatNumber } from "@/utils/format";
import { getChartColors } from "@/utils/constants";
import { useColorMode } from "@/context/ThemeContext";

interface Props {
  comparison: MonthComparison;
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
  const { resolvedMode } = useColorMode();
  const COLORS = getChartColors(resolvedMode);

  const getChangeColor = (): string => {
    if (change.trend === "stable") return COLORS.text;
    if (invertColors) {
      return change.trend === "up" ? COLORS.expense : COLORS.income;
    }
    return change.trend === "up" ? COLORS.income : COLORS.expense;
  };

  const color = getChangeColor();

  return (
    <Card
      sx={{
        flex: 1,
        minWidth: 200,
        borderRadius: 3,
        bgcolor: "background.default",
        boxShadow: 3,
      }}
    >
      <CardContent>
        <Typography variant="body2" sx={{ color: "text.secondary" }} gutterBottom>
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
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
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
