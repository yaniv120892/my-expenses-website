// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { createTestQueryClient, renderWithClient } from '@/test/renderWithClient';
import ApiTokenManager from '@/components/ApiTokenManager';
import { getApiTokens } from '@/services/apiTokenService';
import type { HouseholdRole } from '@/generated/prisma/enums';
import type { MeResponse } from '@/shared/types/household';

vi.mock('@/services/apiTokenService', () => ({
  getApiTokens: vi.fn(),
  createApiToken: vi.fn(),
  revokeApiToken: vi.fn(),
}));

function renderAs(role: HouseholdRole) {
  const queryClient = createTestQueryClient();
  const session: MeResponse = { userId: 'user-1', email: null, role };
  queryClient.setQueryData(['session'], session);
  renderWithClient(<ApiTokenManager />, queryClient);
}

beforeEach(() => {
  vi.mocked(getApiTokens).mockResolvedValue([]);
});

afterEach(cleanup);

describe('ApiTokenManager scopes', () => {
  it('offers an editor every scope', async () => {
    renderAs('EDITOR');

    expect(await screen.findByLabelText(/^Imports/)).toBeTruthy();
    expect(screen.getByLabelText(/^Personal agent/)).toBeTruthy();
  });

  it('offers a viewer only the scopes a read-only token can use', async () => {
    renderAs('VIEWER');

    expect(await screen.findByLabelText(/^Personal agent/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Imports/)).toBeNull();
  });

  it("describes a viewer's agent scope as read-only", async () => {
    renderAs('VIEWER');

    expect(
      await screen.findByLabelText('Personal agent — Read transactions over MCP'),
    ).toBeTruthy();
    expect(screen.queryByText(/add, edit and delete/)).toBeNull();
  });
});
