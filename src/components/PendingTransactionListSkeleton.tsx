'use client';

import React from 'react';
import {
  Box,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useMediaQuery,
  useTheme,
} from '@mui/material';

export default function PendingTransactionListSkeleton({
  rows = 5,
}: {
  rows?: number;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (isMobile) {
    return (
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
          {[...Array(rows)].map((_, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                px: 2,
                py: 1.5,
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Skeleton width="60%" />
                <Skeleton width="40%" />
              </Box>
              <Box sx={{ width: 90 }}>
                <Skeleton width="100%" />
                <Skeleton width="80%" />
              </Box>
            </Box>
          ))}
        </Stack>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Description</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Date</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {[...Array(rows)].map((_, idx) => (
            <TableRow key={idx} sx={{ '&:last-child td': { border: 0 } }}>
              <TableCell>
                <Skeleton width="70%" />
              </TableCell>
              <TableCell>
                <Skeleton width="50%" />
              </TableCell>
              <TableCell>
                <Skeleton width="60%" />
              </TableCell>
              <TableCell align="right">
                <Skeleton width="50%" sx={{ ml: 'auto' }} />
              </TableCell>
              <TableCell align="right">
                <Skeleton width={64} sx={{ ml: 'auto' }} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
