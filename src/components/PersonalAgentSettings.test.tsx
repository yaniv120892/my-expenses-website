// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithClient } from '@/test/renderWithClient';
import PersonalAgentSettings from '@/components/PersonalAgentSettings';
import {
  createApiToken,
  getApiTokens,
  revokeApiToken,
} from '@/services/apiTokenService';
import type { ApiTokenSummary } from '@/types/apiToken';

vi.mock('@/services/apiTokenService', () => ({
  getApiTokens: vi.fn(),
  createApiToken: vi.fn(),
  revokeApiToken: vi.fn(),
}));

const PLAINTEXT_TOKEN = 'mxk_shown-once';

function summary(overrides: Partial<ApiTokenSummary>): ApiTokenSummary {
  return {
    id: 'token-1',
    name: 'Instinct',
    scopes: ['AGENT'],
    createdAt: '2026-10-01T00:00:00.000Z',
    expiresAt: '2027-10-01T00:00:00.000Z',
    lastUsedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getApiTokens).mockResolvedValue([
    summary({ id: 'agent', name: 'Instinct' }),
    summary({ id: 'script', name: 'MacBook script', scopes: ['IMPORTS'] }),
  ]);
  vi.mocked(createApiToken).mockResolvedValue({
    ...summary({ id: 'new' }),
    token: PLAINTEXT_TOKEN,
  });
  vi.mocked(revokeApiToken).mockResolvedValue();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PersonalAgentSettings', () => {
  it('shows the MCP URL of this site', () => {
    renderWithClient(<PersonalAgentSettings />);

    expect(screen.getByLabelText('MCP URL').textContent).toBe(
      `${window.location.origin}/api/mcp`,
    );
  });

  it('issues an AGENT-only token and puts it into the briefing once', async () => {
    renderWithClient(<PersonalAgentSettings />);
    expect(screen.getByLabelText('Briefing').textContent).not.toContain(
      PLAINTEXT_TOKEN,
    );

    fireEvent.click(screen.getByRole('button', { name: 'יצירת גישה לסוכן' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Token').textContent).toBe(PLAINTEXT_TOKEN),
    );
    expect(vi.mocked(createApiToken).mock.calls[0][0]).toEqual({
      name: 'Instinct',
      scopes: ['AGENT'],
    });
    expect(screen.getByLabelText('Briefing').textContent).toContain(
      `Authorization: Bearer ${PLAINTEXT_TOKEN}`,
    );
  });

  it('lists only agent tokens, leaving script tokens to the API token manager', async () => {
    renderWithClient(<PersonalAgentSettings />);

    expect(
      await screen.findByRole('button', { name: 'ביטול הגישה של Instinct' }),
    ).toBeTruthy();
    expect(screen.queryByText('MacBook script')).toBeNull();
  });

  it('revokes an agent token only after confirmation', async () => {
    renderWithClient(<PersonalAgentSettings />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'ביטול הגישה של Instinct' }),
    );
    expect(revokeApiToken).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'ביטול הגישה' }));

    await waitFor(() =>
      expect(vi.mocked(revokeApiToken).mock.calls[0][0]).toBe('agent'),
    );
  });
});
