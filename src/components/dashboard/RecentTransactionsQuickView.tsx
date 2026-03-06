"use client";

import React from "react";
import { Box, Card, CardContent, Typography, Button, Chip } from "@mui/material";
import { RecentTransaction } from "@/types/dashboard";
import { formatNumber, formatTransactionDate } from "@/utils/format";
import { COLORS } from "@/utils/constants";

interface Props {
  transactions: RecentTransaction[];
  onViewAll: () => void;
}

export function RecentTransactionsQuickView({ transactions, onViewAll }: Props) {
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
          <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>
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
                borderBottom: "1px solid var(--secondary-light)",
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
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
                    {formatTransactionDate(tx.date)}
                  </Typography>
                  <Chip
                    label={tx.categoryName}
                    size="small"
                    sx={{ height: 20, fontSize: 11 }}
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
