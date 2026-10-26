// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import ListSkeleton from '@/components/ListSkeleton';
import { renderWithClient } from '@/test/renderWithClient';

describe('ListSkeleton', () => {
  afterEach(cleanup);

  it('shows the headers it is given and aligns the trailing ones to the end', () => {
    renderWithClient(
      <ListSkeleton columns={['תיאור', 'סכום', 'פעולות']} alignEndCount={2} />,
    );
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual([
      'תיאור',
      'סכום',
      'פעולות',
    ]);
    expect(headers[0].className).not.toMatch(/alignRight/);
    expect(headers[1].className).toMatch(/alignRight/);
    expect(headers[2].className).toMatch(/alignRight/);
  });
});
