import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BASE_URL,
  commitConfirmation,
  isLocalTarget,
  parseImportArguments,
  parseStatementName,
  pickOldestImport,
} from './importStatements';

describe('isLocalTarget', () => {
  it('treats loopback hosts as local', () => {
    expect(isLocalTarget('http://127.0.0.1:3000')).toBe(true);
    expect(isLocalTarget('http://localhost:3000')).toBe(true);
    expect(isLocalTarget('http://[::1]:3000')).toBe(true);
  });

  it('treats any other host as remote', () => {
    expect(isLocalTarget('https://expenses.example.com')).toBe(false);
    expect(isLocalTarget('http://192.168.1.10:3000')).toBe(false);
  });
});

describe('commitConfirmation', () => {
  const totals = { merge: 3, create: 2 };

  it('asks y/N for a local target and names it in the prompt', () => {
    const confirmation = commitConfirmation('http://127.0.0.1:3000', totals);
    expect(confirmation.prompt).toContain(
      'Apply 3 merge(s) and 2 create(s) to http://127.0.0.1:3000? [y/N]',
    );
    expect(confirmation.accepts('y')).toBe(true);
    expect(confirmation.accepts(' Y ')).toBe(true);
    expect(confirmation.accepts('yes')).toBe(false);
    expect(confirmation.accepts('')).toBe(false);
  });

  it('requires the hostname typed back for a remote target', () => {
    const confirmation = commitConfirmation(
      'https://expenses.example.com',
      totals,
    );
    expect(confirmation.prompt).toContain('https://expenses.example.com');
    expect(confirmation.prompt).toContain('expenses.example.com');
    expect(confirmation.accepts('y')).toBe(false);
    expect(confirmation.accepts('expenses.example.com')).toBe(true);
    expect(confirmation.accepts(' expenses.example.com\n')).toBe(true);
    expect(confirmation.accepts('https://expenses.example.com')).toBe(false);
  });
});

describe('parseImportArguments', () => {
  it('defaults to a local dry-less run', () => {
    expect(parseImportArguments(['/tmp/statements'])).toEqual({
      directory: '/tmp/statements',
      dryRun: false,
      baseUrl: DEFAULT_BASE_URL,
    });
  });

  it('reads --dry-run and --base-url in any order', () => {
    expect(
      parseImportArguments([
        '--base-url=https://example.com/',
        '/tmp/statements',
        '--dry-run',
      ]),
    ).toEqual({
      directory: '/tmp/statements',
      dryRun: true,
      baseUrl: 'https://example.com',
    });
  });

  it('rejects a bare --base-url instead of taking its value as the directory', () => {
    expect(() =>
      parseImportArguments(['--base-url', 'https://example.com', '/tmp/x']),
    ).toThrow('Unknown option --base-url');
  });

  it('rejects an unknown option', () => {
    expect(() => parseImportArguments(['/tmp/x', '--dryrun'])).toThrow(
      'Unknown option --dryrun',
    );
  });

  it('rejects a second positional argument', () => {
    expect(() => parseImportArguments(['/tmp/x', '/tmp/y'])).toThrow(
      'Unexpected argument /tmp/y',
    );
  });

  it('rejects a base url that is not a url', () => {
    expect(() =>
      parseImportArguments(['/tmp/x', '--base-url=localhost:3000']),
    ).toThrow('--base-url is not a URL');
  });

  it('requires a directory', () => {
    expect(() => parseImportArguments(['--dry-run'])).toThrow('Usage:');
  });
});

describe('parseStatementName', () => {
  it('reads the card and payment month from the naming convention', () => {
    expect(parseStatementName('cal-6125-08-2026.xlsx')).toEqual({
      cardLastFour: '6125',
      paymentMonth: '08/2026',
    });
  });

  it('allows a hyphenated issuer', () => {
    expect(parseStatementName('amex-il-1234-01-2026.csv')).toEqual({
      cardLastFour: '1234',
      paymentMonth: '01/2026',
    });
  });

  it('is null for a portal-named file', () => {
    expect(parseStatementName('transactions 12.09.2026.xlsx')).toBeNull();
  });
});

describe('pickOldestImport', () => {
  it('picks the earliest createdAt regardless of list order', () => {
    const oldest = { id: 'b', createdAt: '2026-03-10T09:00:00.000Z' };
    expect(
      pickOldestImport([
        { id: 'a', createdAt: '2026-03-10T11:00:00.000Z' },
        oldest,
        { id: 'c', createdAt: '2026-03-10T10:00:00.000Z' },
      ]),
    ).toBe(oldest);
  });

  it('breaks a createdAt tie on id, the way the server does', () => {
    const lowerId = { id: 'imp-0', createdAt: '2026-03-10T09:00:00.000Z' };
    expect(
      pickOldestImport([
        { id: 'imp-1', createdAt: '2026-03-10T09:00:00.000Z' },
        lowerId,
      ]),
    ).toBe(lowerId);
  });

  it('is undefined for no candidates', () => {
    expect(pickOldestImport([])).toBeUndefined();
  });
});
