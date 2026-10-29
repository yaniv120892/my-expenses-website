// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithClient } from '@/test/renderWithClient';
import InfiniteScrollSentinel from '@/components/InfiniteScrollSentinel';

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;

function stubIntersectionObserver() {
  const observers: { callback: ObserverCallback; disconnected: boolean }[] = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private readonly record: { callback: ObserverCallback; disconnected: boolean };

      public constructor(callback: ObserverCallback) {
        this.record = { callback, disconnected: false };
        observers.push(this.record);
      }

      public observe(): void {}

      public disconnect(): void {
        this.record.disconnected = true;
      }
    },
  );
  return function intersect(...isIntersecting: boolean[]) {
    const entries = isIntersecting.map((intersecting) => ({ isIntersecting: intersecting }));
    const live = observers.filter((observer) => !observer.disconnected);
    act(() => live.forEach((observer) => observer.callback(entries)));
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('InfiniteScrollSentinel', () => {
  it('calls the latest onLoadMore without re-arming the observer for a new callback', () => {
    const intersect = stubIntersectionObserver();
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = renderWithClient(
      <InfiniteScrollSentinel hasMore loading={false} onLoadMore={first} />,
    );
    rerender(<InfiniteScrollSentinel hasMore loading={false} onLoadMore={latest} />);

    intersect(false);
    expect(latest).not.toHaveBeenCalled();

    intersect(true);
    expect(latest).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('loads more when any batched entry intersects, not only the first', () => {
    const intersect = stubIntersectionObserver();
    const onLoadMore = vi.fn();
    renderWithClient(<InfiniteScrollSentinel hasMore loading={false} onLoadMore={onLoadMore} />);

    intersect(false, true);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('does not observe while a page is loading', () => {
    const intersect = stubIntersectionObserver();
    const onLoadMore = vi.fn();
    renderWithClient(<InfiniteScrollSentinel hasMore loading onLoadMore={onLoadMore} />);

    intersect(true);

    expect(onLoadMore).not.toHaveBeenCalled();
  });
});
