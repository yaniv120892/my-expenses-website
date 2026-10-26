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

const DEFAULT_COLUMN_WIDTH = '60%';
const LEADING_COLUMN_WIDTH = '70%';

/** Columns arrive translated; the trailing `alignEndCount` hold amounts or actions. */
export default function ListSkeleton({
  columns,
  rows = 5,
  mobileLines = 2,
  alignEndCount = 1,
}: {
  columns: string[];
  rows?: number;
  mobileLines?: number;
  alignEndCount?: number;
}) {
  const isMobile = useIsMobile();

  const firstEndAlignedIndex = columns.length - alignEndCount;
  const isEndAligned = (index: number) => index >= firstEndAlignedIndex;

  if (isMobile) {
    return (
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack
          divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}
        >
          {[...Array(rows)].map((_, index) => (
            <Box
              key={index}
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
            {columns.map((column, index) => (
              <TableCell
                key={column}
                align={isEndAligned(index) ? 'right' : 'inherit'}
              >
                {column}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {[...Array(rows)].map((_, index) => (
            <TableRow key={index} sx={{ '&:last-child td': { border: 0 } }}>
              {columns.map((column, columnIndex) => {
                const alignRight = isEndAligned(columnIndex);
                return (
                  <TableCell
                    key={column}
                    align={alignRight ? 'right' : 'inherit'}
                  >
                    <Skeleton
                      width={
                        columnIndex === 0
                          ? LEADING_COLUMN_WIDTH
                          : DEFAULT_COLUMN_WIDTH
                      }
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
