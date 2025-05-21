import React from "react";
import { Box, Paper, Skeleton, Divider } from "@mui/material";

export default function SettingsTabSkeleton() {
  return (
    <Box maxWidth={500} mx="auto" mt={4}>
      <Paper
        elevation={3}
        sx={{ p: 3, mb: 4, backgroundColor: "var(--secondary)" }}
      >
        <Skeleton variant="text" width={120} height={32} sx={{ mb: 2 }} />
        <Divider sx={{ mb: 2 }} />
        <Skeleton variant="text" width={220} height={24} />
      </Paper>
      <Paper elevation={3} sx={{ p: 3, backgroundColor: "var(--secondary)" }}>
        <Skeleton variant="text" width={140} height={32} sx={{ mb: 2 }} />
        <Divider sx={{ mb: 2 }} />
        <Skeleton
          variant="rectangular"
          width={260}
          height={40}
          sx={{ mb: 2, borderRadius: 2 }}
        />
        <Skeleton
          variant="rectangular"
          width={260}
          height={40}
          sx={{ borderRadius: 2 }}
        />
      </Paper>
    </Box>
  );
}
