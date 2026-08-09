'use client';

import { Box, Card, CardContent, Skeleton } from '@mui/material';

export const TrendCardSkeleton = () => (
  <Card variant="outlined" sx={{ mb: 3 }}>
    <CardContent>
      <Skeleton variant="text" width="50%" height={32} />
      <Box sx={{ display: 'flex', gap: 6, mt: 2, flexWrap: 'wrap' }}>
        <Box sx={{ width: 160 }}>
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" height={32} />
        </Box>
        <Box sx={{ width: 160 }}>
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" height={32} />
        </Box>
      </Box>
      <Skeleton
        variant="rounded"
        sx={{ height: { xs: 240, md: 300 }, mt: 2 }}
      />
    </CardContent>
  </Card>
);
