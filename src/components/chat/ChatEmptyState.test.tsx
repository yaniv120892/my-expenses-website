// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DesignTestProvider } from '@/test/renderWithClient';
import ChatEmptyState from './ChatEmptyState';

describe('ChatEmptyState', () => {
  afterEach(cleanup);

  it('sends a suggested prompt in the reader’s language', async () => {
    const onSelectPrompt = vi.fn();
    render(
      <DesignTestProvider locale="he">
        <ChatEmptyState onSelectPrompt={onSelectPrompt} />
      </DesignTestProvider>,
    );

    await userEvent.click(screen.getByText('כמה הוצאתי בחודש שעבר?'));

    expect(onSelectPrompt).toHaveBeenCalledWith('כמה הוצאתי בחודש שעבר?');
  });

  it('keeps the English prompts for an English reader', () => {
    render(
      <DesignTestProvider locale="en">
        <ChatEmptyState onSelectPrompt={vi.fn()} />
      </DesignTestProvider>,
    );
    expect(screen.getByText('How much did I spend last month?')).toBeTruthy();
  });
});
