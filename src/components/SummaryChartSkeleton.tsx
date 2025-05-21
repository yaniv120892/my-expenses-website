import React from "react";
import { Box, Paper, Skeleton } from "@mui/material";

function renderLeftSection() {
  return (
    <Box flex={1} display="flex" flexDirection="column" gap={4}>
      <Skeleton
        variant="text"
        width={160}
        height={24}
        sx={{ mb: 1, bgcolor: "var(--secondary)" }}
      />
      <Skeleton
        variant="rectangular"
        width="60%"
        height={180}
        sx={{ mb: 2, borderRadius: 2, bgcolor: "var(--secondary)" }}
      />
      <Skeleton
        variant="text"
        width={180}
        height={24}
        sx={{ mb: 1, bgcolor: "var(--secondary)" }}
      />
      <Skeleton
        variant="circular"
        width={140}
        height={140}
        sx={{ bgcolor: "var(--secondary)" }}
      />
    </Box>
  );
}

function renderRightSection() {
  return (
    <Box flex={1}>
      <Skeleton
        variant="text"
        width={160}
        height={24}
        sx={{ mb: 1, bgcolor: "var(--secondary)" }}
      />
      <Box display="flex" flexDirection="column" gap={3}>
        {[...Array(3)].map((_, idx) => (
          <Box
            key={idx}
            display="flex"
            flexDirection="row"
            alignItems="center"
            gap={4}
          >
            <Skeleton
              variant="circular"
              width={80}
              height={80}
              sx={{ bgcolor: "var(--secondary)" }}
            />
            <Box display="flex" flexDirection="column" gap={1}>
              <Skeleton
                variant="text"
                width={100}
                height={18}
                sx={{ bgcolor: "var(--secondary)" }}
              />
              <Skeleton
                variant="text"
                width={100}
                height={18}
                sx={{ bgcolor: "var(--secondary)" }}
              />
              <Skeleton
                variant="text"
                width={80}
                height={18}
                sx={{ bgcolor: "var(--secondary)" }}
              />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function SummaryChartSkeleton() {
  return (
    <Paper
      sx={{
        p: 3,
        borderRadius: 4,
        boxShadow: 6,
        mb: 4,
        backgroundColor: "var(--primary)",
      }}
    >
      <Skeleton
        variant="text"
        width={200}
        height={32}
        sx={{ mb: 2, bgcolor: "var(--secondary)" }}
      />
      <Box display="flex" flexDirection={{ xs: "column", md: "row" }} gap={4}>
        {renderLeftSection()}
        {renderRightSection()}
      </Box>
    </Paper>
  );
}
