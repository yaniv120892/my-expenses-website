'use client';

import { useEffect, useRef } from 'react';
import { Box, CircularProgress } from '@mui/material';

interface Props {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

/**
 * Requests the next page when the end of the list scrolls into view. The
 * observer is re-armed whenever hasMore/loading change so a fetch in flight
 * cannot queue a second request for the same page.
 */
export default function InfiniteScrollSentinel({
  hasMore,
  loading,
  onLoadMore,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  if (!hasMore && !loading) {
    return null;
  }

  return (
    <Box
      ref={sentinelRef}
      sx={{ display: 'flex', justifyContent: 'center', py: 2 }}
    >
      {loading && <CircularProgress size={24} />}
    </Box>
  );
}
