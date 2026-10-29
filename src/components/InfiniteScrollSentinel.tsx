'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import { Box, CircularProgress } from '@mui/material';

type Props = {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
};

// Re-armed whenever hasMore/loading change, so a fetch in flight cannot queue a
// second request for the same page.
export default function InfiniteScrollSentinel({ hasMore, loading, onLoadMore }: Props) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMore = useEffectEvent(onLoadMore);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
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
    <Box ref={sentinelRef} sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
      {loading && <CircularProgress size={24} />}
    </Box>
  );
}
