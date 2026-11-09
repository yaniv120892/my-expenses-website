// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createTestQueryClient, createWrapper } from '@/test/renderWithClient';
import { useCanWrite, useIsViewer } from '@/hooks/useSession';
import type { HouseholdRole } from '@/generated/prisma/enums';
import type { MeResponse } from '@/shared/types/household';

vi.mock('@/services/api', () => ({
  default: { get: () => new Promise(() => {}) },
}));

function renderWithRole(role: HouseholdRole | null) {
  const queryClient = createTestQueryClient();
  if (role) {
    const session: MeResponse = { userId: 'user-1', email: null, role };
    queryClient.setQueryData(['session'], session);
  }
  const wrapper = createWrapper(queryClient);
  return {
    canWrite: renderHook(() => useCanWrite(), { wrapper }).result.current,
    isViewer: renderHook(() => useIsViewer(), { wrapper }).result.current,
  };
}

describe('useCanWrite', () => {
  it('offers no write control until the role is known', () => {
    expect(renderWithRole(null)).toEqual({ canWrite: false, isViewer: false });
  });

  it('offers write controls to an editor and none to a viewer', () => {
    expect(renderWithRole('EDITOR')).toEqual({ canWrite: true, isViewer: false });
    expect(renderWithRole('VIEWER')).toEqual({ canWrite: false, isViewer: true });
  });
});
