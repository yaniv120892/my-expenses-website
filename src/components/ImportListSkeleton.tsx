'use client';

import React from 'react';
import { Box, Paper, Skeleton, Stack } from '@mui/material';

export default function ImportListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Paper variant="outlined">
      <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
        {[...Array(rows)].map((_, idx) => (
          <Stack
            key={idx}
            direction="row"
            alignItems="center"
            spacing={2}
            sx={{ px: 2, py: 1.5 }}
          >
            <Box sx={{ flex: 1 }}>
              <Skeleton width="45%" />
              <Skeleton width="30%" />
            </Box>
            <Skeleton variant="rounded" width={80} height={24} />
            <Skeleton variant="circular" width={24} height={24} />
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
