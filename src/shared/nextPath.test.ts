import { describe, expect, it } from 'vitest';
import { safeNextPath, withNextPath } from '@/shared/nextPath';

describe('safeNextPath', () => {
  it.each(['/join?code=ABCD2345', '/dashboard'])('keeps the on-site path %s', (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    null,
    '',
    'https://evil.example/join',
    '//evil.example/join',
    '/\\evil.example',
    '/\\/evil.example',
    'javascript:alert(1)',
    '/\t/evil.example',
    '/\n/evil.example',
    '/\r/evil.example',
    '/\u0000/evil.example',
    '/\u007f/evil.example',
    '/dashboard\n',
  ])('refuses %s', (value) => {
    expect(safeNextPath(value)).toBeNull();
  });
});

describe('withNextPath', () => {
  it('encodes the destination onto a path with or without a query', () => {
    expect(withNextPath({ path: '/login', next: '/join?code=AB' })).toBe(
      '/login?next=%2Fjoin%3Fcode%3DAB',
    );
    expect(withNextPath({ path: '/verify?email=a%40b.c', next: '/join' })).toBe(
      '/verify?email=a%40b.c&next=%2Fjoin',
    );
  });

  it('leaves the path alone when there is nowhere to go next', () => {
    expect(withNextPath({ path: '/login', next: null })).toBe('/login');
  });
});
