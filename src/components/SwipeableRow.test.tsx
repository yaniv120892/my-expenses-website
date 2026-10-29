// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithClient } from '@/test/renderWithClient';
import SwipeableRow from '@/components/SwipeableRow';

afterEach(() => {
  cleanup();
});

function row(): HTMLElement {
  const content = screen.getByText('row content');
  const sliding = content.parentElement;
  if (!sliding) {
    throw new Error('row content has no sliding container');
  }
  return sliding;
}

function touchAt(clientX: number, clientY = 0) {
  return { touches: [{ clientX, clientY }] };
}

describe('SwipeableRow', () => {
  it('follows the finger without a transition while dragging, then animates back', () => {
    const onSwipeLeft = vi.fn();
    renderWithClient(
      <SwipeableRow onSwipeLeft={onSwipeLeft} leftLabel="Delete">
        <span>row content</span>
      </SwipeableRow>,
    );

    fireEvent.touchStart(row(), touchAt(200));
    fireEvent.touchMove(row(), touchAt(180));
    fireEvent.touchMove(row(), touchAt(90));

    expect(getComputedStyle(row()).transition).toBe('none');
    expect(screen.getByText('Delete')).toBeTruthy();

    fireEvent.touchEnd(row());

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(getComputedStyle(row()).transition).toBe('transform 0.25s ease-out');
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('ignores a mostly vertical swipe', () => {
    const onSwipeLeft = vi.fn();
    renderWithClient(
      <SwipeableRow onSwipeLeft={onSwipeLeft} leftLabel="Delete">
        <span>row content</span>
      </SwipeableRow>,
    );

    fireEvent.touchStart(row(), touchAt(200, 0));
    fireEvent.touchMove(row(), touchAt(195, 40));
    fireEvent.touchMove(row(), touchAt(50, 200));
    fireEvent.touchEnd(row());

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
