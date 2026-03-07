"use client";

import React, { useRef, useState, useCallback } from "react";
import { Box } from "@mui/material";

const THRESHOLD = 80;

interface SwipeableRowProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftLabel?: string;
  rightLabel?: string;
  leftColor?: string;
  rightColor?: string;
}

export default function SwipeableRow({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftLabel = "Delete",
  rightLabel = "Edit",
  leftColor = "error.main",
  rightColor = "success.main",
}: SwipeableRowProps) {
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
    if (!isDragging.current) return;

    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (isHorizontal.current === null) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (!isHorizontal.current) return;

    const clamped = Math.max(-THRESHOLD - 20, Math.min(THRESHOLD + 20, dx));
    setOffsetX(clamped);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
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

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        touchAction: "pan-y",
      }}
    >
      {showRight && (
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: Math.abs(offsetX),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: rightColor,
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            borderRadius: "8px 0 0 8px",
            zIndex: 0,
          }}
        >
          {rightLabel}
        </Box>
      )}
      {showLeft && (
        <Box
          sx={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: Math.abs(offsetX),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: leftColor,
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            borderRadius: "0 8px 8px 0",
            zIndex: 0,
          }}
        >
          {leftLabel}
        </Box>
      )}
      <Box
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        sx={{
          position: "relative",
          zIndex: 1,
          transform: `translateX(${offsetX}px)`,
          transition: isDragging.current ? "none" : "transform 0.25s ease-out",
          willChange: "transform",
          bgcolor: "background.paper",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
