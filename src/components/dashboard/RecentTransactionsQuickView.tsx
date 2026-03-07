"use client";

import React from "react";
import { Box, Card, CardContent, Typography, Button, Chip } from "@mui/material";
import { RecentTransaction } from "@/types/dashboard";
import { formatNumber, formatTransactionDate } from "@/utils/format";
import { getChartColors } from "@/utils/constants";
import { useColorMode } from "@/context/ThemeContext";

interface Props {
  transactions: RecentTransaction[];
  onViewAll: () => void;
}

export function RecentTransactionsQuickView({ transactions, onViewAll }: Props) {
  const { resolvedMode } = useColorMode();
  const COLORS = getChartColors(resolvedMode);
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
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h6" fontWeight={700} color={COLORS.text}>
            Recent Transactions
          </Typography>
          <Button
            size="small"
            onClick={onViewAll}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            View All
          </Button>
        </Box>

        {!transactions.length && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            No transactions yet
          </Typography>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {transactions.map((tx) => (
            <Box
              key={tx.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: 0.5,
                borderBottom: 1, borderColor: "divider",
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  color={COLORS.text}
                  noWrap
                >
                  {tx.description}
                </Typography>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}
                >
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {formatTransactionDate(tx.date)}
                  </Typography>
                  <Chip
                    label={tx.categoryName}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: 11,
                      bgcolor: "action.selected",
                      color: "text.primary",
                    }}
                  />
                </Box>
              </Box>
              <Typography
                variant="body2"
                fontWeight={700}
                sx={{
                  color: tx.type === "INCOME" ? COLORS.income : COLORS.expense,
                  whiteSpace: "nowrap",
                }}
              >
                {tx.type === "INCOME" ? "+" : "-"}
                {formatNumber(tx.value)}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
