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
} from '@mui/material';
import { useIsMobile } from '../hooks/useBreakpoints';

const RIGHT_ALIGNED_COLUMNS = ['Amount', 'Actions'];

const COLUMN_WIDTHS: Record<string, string | number> = {
  Description: '70%',
  Category: '50%',
  Date: '60%',
  Schedule: '70%',
  'Next run': '60%',
  Amount: '50%',
  Actions: 64,
};

export default function ListSkeleton({
  columns,
  rows = 5,
  mobileLines = 2,
}: {
  columns: string[];
  rows?: number;
  mobileLines?: number;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack
          divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}
        >
          {[...Array(rows)].map((_, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: mobileLines > 2 ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                gap: 2,
                px: 2,
                py: 1.5,
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Skeleton width="60%" />
                <Skeleton width="40%" />
                {mobileLines > 2 && <Skeleton width="50%" />}
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
            {columns.map((column) => (
              <TableCell
                key={column}
                align={
                  RIGHT_ALIGNED_COLUMNS.includes(column) ? 'right' : 'inherit'
                }
              >
                {column}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {[...Array(rows)].map((_, idx) => (
            <TableRow key={idx} sx={{ '&:last-child td': { border: 0 } }}>
              {columns.map((column) => {
                const alignRight = RIGHT_ALIGNED_COLUMNS.includes(column);
                return (
                  <TableCell
                    key={column}
                    align={alignRight ? 'right' : 'inherit'}
                  >
                    <Skeleton
                      width={COLUMN_WIDTHS[column] ?? '60%'}
                      sx={alignRight ? { ml: 'auto' } : undefined}
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
