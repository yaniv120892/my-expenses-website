"use client";

import React from "react";
import { Box, Paper, Skeleton } from "@mui/material";

export function DashboardSkeleton() {
  return (
    <Box sx={{ p: 3 }}>
      {/* Month comparison cards skeleton */}
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {[1, 2, 3].map((i) => (
          <Paper
            key={i}
            sx={{
              flex: 1,
              minWidth: 200,
              p: 2,
              borderRadius: 3,
              bgcolor: "var(--background)",
              boxShadow: 3,
            }}
          >
            <Skeleton
              variant="text"
              width={80}
              height={20}
              sx={{ bgcolor: "var(--secondary)", mb: 1 }}
            />
            <Skeleton
              variant="text"
              width={120}
              height={32}
              sx={{ bgcolor: "var(--secondary)", mb: 1 }}
            />
            <Skeleton
              variant="text"
              width={100}
              height={16}
              sx={{ bgcolor: "var(--secondary)" }}
            />
          </Paper>
        ))}
      </Box>
      {/* Chart + insights skeleton */}
      <Box
        sx={{
          display: "flex",
          gap: 3,
          mt: 3,
          flexDirection: { xs: "column", md: "row" },
        }}
      >
        <Paper
          sx={{
            flex: 2,
            p: 2,
            borderRadius: 3,
            bgcolor: "var(--background)",
            boxShadow: 3,
          }}
        >
          <Skeleton
            variant="text"
            width={160}
            height={24}
            sx={{ bgcolor: "var(--secondary)", mb: 2 }}
          />
          <Skeleton
            variant="circular"
            width={200}
            height={200}
            sx={{ bgcolor: "var(--secondary)", mx: "auto" }}
          />
        </Paper>
        <Paper
          sx={{
            flex: 1,
            p: 2,
            borderRadius: 3,
            bgcolor: "var(--background)",
            boxShadow: 3,
          }}
        >
          <Skeleton
            variant="text"
            width={120}
            height={24}
            sx={{ bgcolor: "var(--secondary)", mb: 2 }}
          />
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              variant="text"
              width="90%"
              height={20}
              sx={{ bgcolor: "var(--secondary)", mb: 1 }}
            />
          ))}
        </Paper>
      </Box>
      {/* Bottom row skeleton */}
      <Box
        sx={{
          display: "flex",
          gap: 3,
          mt: 3,
          flexDirection: { xs: "column", md: "row" },
        }}
      >
        <Paper
          sx={{
            flex: 1,
            p: 2,
            borderRadius: 3,
            bgcolor: "var(--background)",
            boxShadow: 3,
          }}
        >
          <Skeleton
            variant="text"
            width={180}
            height={24}
            sx={{ bgcolor: "var(--secondary)", mb: 2 }}
          />
          <Skeleton
            variant="rectangular"
            width="100%"
            height={80}
            sx={{ bgcolor: "var(--secondary)", borderRadius: 1 }}
          />
        </Paper>
        <Paper
          sx={{
            flex: 1,
            p: 2,
            borderRadius: 3,
            bgcolor: "var(--background)",
            boxShadow: 3,
          }}
        >
          <Skeleton
            variant="text"
            width={160}
            height={24}
            sx={{ bgcolor: "var(--secondary)", mb: 2 }}
          />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton
              key={i}
              variant="text"
              width="100%"
              height={20}
              sx={{ bgcolor: "var(--secondary)", mb: 1 }}
            />
          ))}
        </Paper>
      </Box>
    </Box>
  );
}
