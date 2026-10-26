import type { Direction } from '@yaniv120892/my-ui';

export const ALL_CATEGORIES = 'All Categories';

/**
 * Trend points arrive newest first; reversing the axis in LTR, and leaving it
 * in RTL, puts the oldest point at the reader's starting edge either way.
 */
export function shouldReverseNewestFirstAxis(direction: Direction): boolean {
  return direction === 'ltr';
}

/** The value axis sits at the reader's starting edge. */
export function valueAxisOrientation(direction: Direction): 'left' | 'right' {
  return direction === 'rtl' ? 'right' : 'left';
}
