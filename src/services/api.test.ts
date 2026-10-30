import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import { AxiosError } from 'axios';
import api from '@/services/api';
import { householdErrorCode } from '@/utils/householdError';
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
    const location = stubLocation();
    vi.mocked(logout).mockResolvedValue();

    const results = await Promise.allSettled(
      [1, 2, 3].map(() => api.get('/api/x', { adapter: rejectWith401() })),
    );

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(location.href).toBe('https://app.test/login?reason=session-expired&next=%2Fdashboard');
  });

  it('still redirects when the logout request fails', async () => {
    vi.resetModules();
    const { default: freshApi } = await import('@/services/api');
    const location = stubLocation();
    vi.mocked(logout).mockRejectedValue(new Error('network down'));

    await expect(freshApi.get('/api/x', { adapter: rejectWith401() })).rejects.toThrow();

    expect(location.href).toBe('https://app.test/login?reason=session-expired&next=%2Fdashboard');
  });
});

describe('api error messages', () => {
  it("replaces axios's generic message with the server's own", async () => {
    const rejectWith400 = (config: InternalAxiosRequestConfig) =>
      Promise.reject(
        new AxiosError('Request failed with status code 400', '400', config, null, {
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          config,
          data: { message: 'Amount must be positive' },
        }),
      );

    await expect(api.get('/api/x', { adapter: rejectWith400 })).rejects.toThrow(
      'Amount must be positive',
    );
  });

  it('parses a JSON error that arrived as a Blob, so its code can be read', async () => {
    const rejectWithBlob = (config: InternalAxiosRequestConfig) =>
      Promise.reject(
        new AxiosError('Request failed with status code 409', '409', config, null, {
          status: 409,
          statusText: 'Conflict',
          headers: {},
          config,
          data: new Blob([
            JSON.stringify({ error: 'Conflict', message: 'In use', code: 'HOUSEHOLD_IN_USE' }),
          ]),
        }),
      );

    let failure: unknown = null;
    try {
      await api.get('/api/x', { adapter: rejectWithBlob, responseType: 'blob' });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toHaveProperty('message', 'In use');
    expect(householdErrorCode(failure)).toBe('HOUSEHOLD_IN_USE');
  });
});

function stubLocation() {
  const location = {
    origin: 'https://app.test',
    pathname: '/dashboard',
    search: '',
    href: 'https://app.test/dashboard',
  };
  vi.stubGlobal('window', { location });
  return location;
}
