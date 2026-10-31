import { afterEach, describe, expect, it, vi } from 'vitest';
import { redirectToSessionExpired } from '@/utils/hardNavigate';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubLocation({ pathname, search }: { pathname: string; search: string }) {
  const location = {
    origin: 'https://app.test',
    pathname,
    search,
    href: `https://app.test${pathname}${search}`,
  };
  vi.stubGlobal('window', { location });
  return location;
}

describe('redirectToSessionExpired', () => {
  it('keeps an invite link, query and all, as where to return after signing in', () => {
    const location = stubLocation({ pathname: '/join', search: '?code=ABCD2345' });

    redirectToSessionExpired();

    const url = new URL(location.href);
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('reason')).toBe('session-expired');
    expect(url.searchParams.get('next')).toBe('/join?code=ABCD2345');
  });

  it('never carries a path that would leave the site', () => {
    const location = stubLocation({ pathname: '//evil.example/x', search: '' });

    redirectToSessionExpired();

    expect(new URL(location.href).searchParams.has('next')).toBe(false);
  });
});
