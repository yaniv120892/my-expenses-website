import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import api from '@/services/api';
import { logout } from '@/services/authClient';

vi.mock('@/services/authClient', () => ({ logout: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
});

function rejectWith401() {
  return (config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError('Unauthorized', '401', config, null, {
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config,
        data: { message: 'Authentication required' },
      }),
    );
}

describe('api 401 interceptor', () => {
  it('clears the session once and redirects when several requests 401 together', async () => {
    const location = { pathname: '/dashboard', href: '/dashboard' };
    vi.stubGlobal('window', { location });
    vi.mocked(logout).mockResolvedValue();

    const results = await Promise.allSettled(
      [1, 2, 3].map(() => api.get('/api/x', { adapter: rejectWith401() })),
    );

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(location.href).toBe('/login?reason=session-expired');
  });
});
