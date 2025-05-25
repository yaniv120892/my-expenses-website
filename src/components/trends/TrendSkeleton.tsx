import { Box, Card, CardContent, Skeleton } from "@mui/material";

export const TrendCardSkeleton = () => (
  <Card sx={{ mb: 4 }}>
    <CardContent sx={{ backgroundColor: "var(--background)" }}>
      <Skeleton
        variant="text"
        width="50%"
        height={32}
        sx={{ bgcolor: "var(--secondary)" }}
      />
      <Box sx={{ height: 300, mt: 2 }}>
        <Skeleton
          variant="rectangular"
          height="100%"
          sx={{ bgcolor: "var(--secondary)" }}
        />
      </Box>
      <Box sx={{ display: "flex", gap: 2, mt: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
          <Skeleton
            variant="text"
            width="60%"
            sx={{ bgcolor: "var(--secondary)" }}
          />
          <Skeleton
            variant="text"
            width="40%"
            sx={{ bgcolor: "var(--secondary)" }}
          />
        </Box>
        <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
          <Skeleton
            variant="text"
            width="60%"
            sx={{ bgcolor: "var(--secondary)" }}
          />
          <Skeleton
            variant="text"
            width="40%"
            sx={{ bgcolor: "var(--secondary)" }}
          />
        </Box>
      </Box>
    </CardContent>
  </Card>
);
