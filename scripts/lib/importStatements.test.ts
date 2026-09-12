import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BASE_URL,
  parseImportArguments,
  parseStatementName,
  pickOldestImport,
} from './importStatements';

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
