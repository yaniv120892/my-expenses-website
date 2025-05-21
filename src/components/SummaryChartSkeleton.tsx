import React from "react";
import { Box, Paper, Skeleton } from "@mui/material";

export default function SummaryChartSkeleton() {
  return (
    <Paper sx={{ p: 3, borderRadius: 4, boxShadow: 6, mb: 4 }}>
      <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
      <Box display="flex" flexDirection={{ xs: "column", md: "row" }} gap={4}>
        <Box flex={1} display="flex" flexDirection="column" gap={4}>
          <Skeleton variant="text" width={160} height={24} sx={{ mb: 1 }} />
          <Skeleton
            variant="rectangular"
            width="60%"
            height={180}
            sx={{ mb: 2, borderRadius: 2 }}
          />
          <Skeleton variant="text" width={180} height={24} sx={{ mb: 1 }} />
          <Skeleton variant="circular" width={140} height={140} />
        </Box>
        <Box flex={1}>
          <Skeleton variant="text" width={160} height={24} sx={{ mb: 1 }} />
          <Box display="flex" flexDirection="column" gap={3}>
            {[...Array(3)].map((_, idx) => (
              <Box
                key={idx}
                display="flex"
                flexDirection="row"
                alignItems="center"
                gap={4}
              >
                <Skeleton variant="circular" width={80} height={80} />
                <Box display="flex" flexDirection="column" gap={1}>
                  <Skeleton variant="text" width={100} height={18} />
                  <Skeleton variant="text" width={100} height={18} />
                  <Skeleton variant="text" width={80} height={18} />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
