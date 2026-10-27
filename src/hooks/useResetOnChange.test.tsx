// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResetOnChange } from '@/hooks/useResetOnChange';

describe('useResetOnChange', () => {
  it('resets on the first render and again only when a dependency changes', () => {
    const reset = vi.fn();
    const initial = { id: 'a' };
    const { rerender } = renderHook(
      ({ open, source }: { open: boolean; source: object }) =>
        useResetOnChange({ deps: [open, source], reset: () => reset(open, source) }),
      { initialProps: { open: false, source: initial } },
    );
    expect(reset).toHaveBeenCalledTimes(1);

    rerender({ open: false, source: initial });
    expect(reset).toHaveBeenCalledTimes(1);

    rerender({ open: true, source: initial });
    expect(reset).toHaveBeenCalledTimes(2);
    expect(reset).toHaveBeenLastCalledWith(true, initial);

    const replaced = { id: 'a' };
    rerender({ open: true, source: replaced });
    expect(reset).toHaveBeenCalledTimes(3);
    expect(reset).toHaveBeenLastCalledWith(true, replaced);
  });
});
