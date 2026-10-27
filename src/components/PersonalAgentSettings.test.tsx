// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  createTestQueryClient,
  DesignTestProvider,
  renderWithClient,
} from '@/test/renderWithClient';
import PersonalAgentSettings from '@/components/PersonalAgentSettings';
import { createApiToken, getApiTokens, revokeApiToken } from '@/services/apiTokenService';
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
    summary({
      id: 'both',
      name: 'Imports and agent',
      scopes: ['IMPORTS', 'AGENT'],
    }),
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

    expect(screen.getByLabelText('MCP URL').textContent).toBe(`${window.location.origin}/api/mcp`);
  });

  it('issues an AGENT-only token and puts it into the briefing once', async () => {
    renderWithClient(<PersonalAgentSettings />);
    expect(screen.getByLabelText('Briefing').textContent).not.toContain(PLAINTEXT_TOKEN);

    fireEvent.click(screen.getByRole('button', { name: 'Give the agent access' }));

    await waitFor(() => expect(screen.getByLabelText('Token').textContent).toBe(PLAINTEXT_TOKEN));
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

    expect(await screen.findByRole('button', { name: 'Remove access for Instinct' })).toBeTruthy();
    expect(screen.queryByText('MacBook script')).toBeNull();
  });

  it('leaves a token that also drives imports to the API token manager', async () => {
    renderWithClient(<PersonalAgentSettings />);

    await screen.findByRole('button', { name: 'Remove access for Instinct' });
    expect(screen.queryByText('Imports and agent')).toBeNull();
  });

  it('stops showing the new token once it is revoked', async () => {
    vi.mocked(getApiTokens).mockResolvedValue([summary({ id: 'new', name: 'Instinct' })]);
    renderWithClient(<PersonalAgentSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'Give the agent access' }));
    await screen.findByLabelText('Token');

    fireEvent.click(await screen.findByRole('button', { name: 'Remove access for Instinct' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove access' }));

    await waitFor(() => expect(screen.queryByLabelText('Token')).toBeNull());
    expect(screen.getByLabelText('Briefing').textContent).not.toContain(PLAINTEXT_TOKEN);
  });

  it('revokes an agent token only after confirmation', async () => {
    renderWithClient(<PersonalAgentSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remove access for Instinct' }));
    expect(revokeApiToken).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove access' }));

    await waitFor(() => expect(vi.mocked(revokeApiToken).mock.calls[0][0]).toBe('agent'));
  });

  it('reads in Hebrew for a Hebrew-speaking user, briefing the agent in English', async () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <DesignTestProvider locale="he">
          <PersonalAgentSettings />
        </DesignTestProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('button', { name: 'יצירת גישה לסוכן' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'ביטול הגישה של Instinct' })).toBeTruthy();
    expect(screen.getByLabelText('הודעה לסוכן').textContent).toContain('HOW TO CONNECT');
  });
});
