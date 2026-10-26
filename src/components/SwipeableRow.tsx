'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Box, useTheme } from '@mui/material';

const THRESHOLD = 80;

type SwipeLeft =
  | { onSwipeLeft: () => void; leftLabel: string }
  | { onSwipeLeft?: never; leftLabel?: never };

type SwipeRight =
  | { onSwipeRight: () => void; rightLabel: string }
  | { onSwipeRight?: never; rightLabel?: never };

type SwipeableRowProps = {
  children: React.ReactNode;
  leftColor?: string;
  rightColor?: string;
} & SwipeLeft &
  SwipeRight;

export default function SwipeableRow({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftLabel,
  rightLabel,
  leftColor = 'error.main',
  rightColor = 'success.main',
}: SwipeableRowProps) {
  const theme = useTheme();
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
    isHorizontal.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) {
      return;
    }

    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (isHorizontal.current === null) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (!isHorizontal.current) {
      return;
    }

    const clamped = Math.max(-THRESHOLD - 20, Math.min(THRESHOLD + 20, dx));
    setOffsetX(clamped);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) {
      return;
    }
    isDragging.current = false;

    if (offsetX > THRESHOLD && onSwipeRight) {
      onSwipeRight();
    } else if (offsetX < -THRESHOLD && onSwipeLeft) {
      onSwipeLeft();
    }

    setOffsetX(0);
    isHorizontal.current = null;
  }, [offsetX, onSwipeLeft, onSwipeRight]);

  const showLeft = offsetX < -20 && onSwipeLeft;
  const showRight = offsetX > 20 && onSwipeRight;

  const actionSx = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: Math.abs(offsetX),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'common.white',
    fontWeight: 700,
    fontSize: 14,
    zIndex: 0,
  } as const;

  // A swipe is physical: the finger and translateX move the same way in either
  // direction, so each label is pinned to a physical side. Named the opposite
  // side under RTL, where the stylesheet plugin flips left and right back.
  const isRtl = theme.direction === 'rtl';
  const physicalLeft = isRtl ? 'right' : 'left';
  const physicalRight = isRtl ? 'left' : 'right';

  return (
    <Box
      sx={{ position: 'relative', overflow: 'hidden', touchAction: 'pan-y' }}
    >
      {showRight && (
        <Box sx={{ ...actionSx, [physicalLeft]: 0, bgcolor: rightColor }}>
          {rightLabel}
        </Box>
      )}
      {showLeft && (
        <Box sx={{ ...actionSx, [physicalRight]: 0, bgcolor: leftColor }}>
          {leftLabel}
        </Box>
      )}
      <Box
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        sx={{
          position: 'relative',
          zIndex: 1,
          transform: `translateX(${offsetX}px)`,
          transition: isDragging.current ? 'none' : 'transform 0.25s ease-out',
          willChange: 'transform',
          bgcolor: 'background.paper',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
