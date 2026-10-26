// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithClient } from '@/test/renderWithClient';
import TelegramLinkSettings from '@/components/TelegramLinkSettings';

const { useUserSettingsQuery, createCode } = vi.hoisted(() => ({
  useUserSettingsQuery: vi.fn(),
  createCode: vi.fn(),
}));

vi.mock('@/hooks/useUserSettingsQuery', () => ({
  useUserSettingsQuery,
  useCreateTelegramLinkCodeMutation: () => ({
    mutate: createCode,
    isPending: false,
  }),
  useUnlinkTelegramMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useTestTelegramMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const CODE = {
  code: 'abc123',
  command: '/start abc123',
  deepLink: null,
  expiresInSeconds: 600,
};

const onResult = vi.fn();

function lastPollRequest(): boolean {
  const calls = useUserSettingsQuery.mock.calls;
  return calls[calls.length - 1][0].awaitingTelegramLink;
}

beforeEach(() => {
  vi.clearAllMocks();
  createCode.mockImplementation(
    (_: undefined, { onSuccess }: { onSuccess: (code: typeof CODE) => void }) =>
      onSuccess(CODE),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TelegramLinkSettings', () => {
  it('polls while a first link is pending and stops once the chat is linked', () => {
    const { rerender } = renderWithClient(
      <TelegramLinkSettings linked={false} onResult={onResult} />,
    );
    expect(lastPollRequest()).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Link Telegram' }));
    expect(screen.getByText(/Waiting for the bot/)).toBeTruthy();
    expect(lastPollRequest()).toBe(true);

    rerender(<TelegramLinkSettings linked onResult={onResult} />);
    expect(screen.queryByText(/Send this message/)).toBeNull();
    expect(lastPollRequest()).toBe(false);
  });

  it('keeps a relink code on screen without polling until Done', () => {
    renderWithClient(<TelegramLinkSettings linked onResult={onResult} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Link a different chat' }),
    );
    expect(screen.getByText(/Send this message/)).toBeTruthy();
    expect(lastPollRequest()).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(/Send this message/)).toBeNull();
  });

  it('stops polling and says so when the code expires', () => {
    vi.useFakeTimers();
    renderWithClient(
      <TelegramLinkSettings linked={false} onResult={onResult} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Link Telegram' }));
    expect(lastPollRequest()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(CODE.expiresInSeconds * 1000);
    });
    expect(screen.getByText(/This code has expired/)).toBeTruthy();
    expect(lastPollRequest()).toBe(false);
  });
});
