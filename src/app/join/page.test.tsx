// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderWithClient } from '@/test/renderWithClient';
import JoinPage from '@/app/join/page';

const { useInvitePreviewQuery } = vi.hoisted(() => ({ useInvitePreviewQuery: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams('code=ZZZZZZZZ'),
}));
vi.mock('@/hooks/useHouseholdQuery', () => ({
  useInvitePreviewQuery,
  useJoinHouseholdMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

afterEach(cleanup);

describe('JoinPage', () => {
  it('offers the way to the dashboard when the invite is not valid', () => {
    useInvitePreviewQuery.mockReturnValue({
      isLoading: false,
      error: new Error('Request failed with status code 404'),
      data: undefined,
    });

    renderWithClient(<JoinPage />);

    expect(screen.getByRole('alert').textContent).toContain('not valid');
    expect(screen.getByRole('link', { name: 'Go to the dashboard' }).getAttribute('href')).toBe(
      '/dashboard',
    );
  });
});
