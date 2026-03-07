"use client";

import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { TopCategory } from "@/types/dashboard";
import { formatNumber } from "@/utils/format";
import { getChartColors } from "@/utils/constants";
import { useColorMode } from "@/context/ThemeContext";
import { TrendIcon } from "@/components/trends/TrendIcon";

const DOUGHNUT_COLORS = [
  "#f39c12",
  "#3498db",
  "#e67e22",
  "#9b59b6",
  "#1abc9c",
  "#e74c3c",
  "#2ecc71",
];

interface Props {
  categories: TopCategory[];
}

export function TopCategoriesChart({ categories }: Props) {
  const { resolvedMode } = useColorMode();
  const COLORS = getChartColors(resolvedMode);

  const CompactTooltip: React.FC<{
    active?: boolean;
    payload?: { name: string; value: number }[];
  }> = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const { name, value } = payload[0];
    return (
      <div
        style={{
          background: COLORS.background,
          color: COLORS.text,
          fontSize: 12,
          padding: "2px 8px",
          borderRadius: 6,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontWeight: 500 }}>{name}:</span> {formatNumber(value)}
      </div>
    );
  };
  if (!categories.length) {
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
          <Typography variant="h6" fontWeight={700} color={COLORS.text} mb={2}>
            Top Categories
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>No expense data yet</Typography>
        </CardContent>
      </Card>
    );
  }

  const chartData = categories.map((c) => ({
    name: c.categoryName,
    value: c.amount,
  }));

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
        <Typography variant="h6" fontWeight={700} color={COLORS.text} mb={2}>
          Top Categories
        </Typography>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: "center",
            gap: 2,
          }}
        >
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                stroke={COLORS.background}
                strokeWidth={2}
              >
                {chartData.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={DOUGHNUT_COLORS[idx % DOUGHNUT_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CompactTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              minWidth: 200,
            }}
          >
            {categories.map((cat, idx) => (
              <Box
                key={cat.categoryId}
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    bgcolor: DOUGHNUT_COLORS[idx % DOUGHNUT_COLORS.length],
                    flexShrink: 0,
                  }}
                />
                <Typography
                  variant="body2"
                  color={COLORS.text}
                  sx={{ flex: 1 }}
                >
                  {cat.categoryName}
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  color={COLORS.text}
                >
                  {formatNumber(cat.amount)}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  ({cat.percentage.toFixed(1)}%)
                </Typography>
                <TrendIcon trend={cat.change.trend} />
              </Box>
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
