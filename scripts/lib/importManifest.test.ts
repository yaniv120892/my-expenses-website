import { describe, expect, it } from 'vitest';
import {
  emptyManifest,
  parseManifest,
  planDrift,
  recordedImport,
  recordedPreview,
  serializeManifest,
  withPreview,
  withResolvedImport,
  withSubmission,
} from './importManifest';

const LOCAL = 'http://127.0.0.1:3000';
const SITE = 'https://expenses.example.com';
const AT = new Date('2026-09-12T10:00:00.000Z');

describe('manifest round trip', () => {
  it('serializes and parses what was recorded', () => {
    const manifest = withPreview(
      withSubmission(emptyManifest(), LOCAL, 'cal-1-01-2026.xlsx', 'imp-1', AT),
      LOCAL,
      'imp-1',
      ['row-a', 'row-b'],
      AT,
    );

    const reparsed = parseManifest(serializeManifest(manifest), 'manifest');

    expect(recordedImport(reparsed, LOCAL, 'cal-1-01-2026.xlsx')).toEqual({
      importId: 'imp-1',
      submittedAt: AT.toISOString(),
    });
    expect(recordedPreview(reparsed, LOCAL, 'imp-1')).toEqual({
      rowIds: ['row-a', 'row-b'],
      previewedAt: AT.toISOString(),
    });
  });

  it('rejects text that is not JSON, naming the file', () => {
    expect(() =>
      parseManifest('{nope', '/tmp/x/.import-statements.json'),
    ).toThrow('/tmp/x/.import-statements.json is not valid JSON');
  });

  it('rejects JSON of another shape, naming the file', () => {
    expect(() => parseManifest('{"version":2}', 'manifest')).toThrow(
      'does not look like an import manifest',
    );
  });
});

describe('recordedImport', () => {
  it('keeps targets apart, so a rehearsal never stands in for production', () => {
    const manifest = withSubmission(
      emptyManifest(),
      LOCAL,
      'cal-1-01-2026.xlsx',
      'imp-local',
      AT,
    );

    expect(
      recordedImport(manifest, LOCAL, 'cal-1-01-2026.xlsx')?.importId,
    ).toBe('imp-local');
    expect(
      recordedImport(manifest, SITE, 'cal-1-01-2026.xlsx'),
    ).toBeUndefined();
  });

  it('is undefined for a file never submitted', () => {
    expect(recordedImport(emptyManifest(), LOCAL, 'x.xlsx')).toBeUndefined();
  });

  it('a later submission of the same file replaces the earlier one', () => {
    const first = withSubmission(emptyManifest(), LOCAL, 'a.xlsx', 'imp-1', AT);
    const second = withSubmission(first, LOCAL, 'a.xlsx', 'imp-2', AT);

    expect(recordedImport(second, LOCAL, 'a.xlsx')?.importId).toBe('imp-2');
    expect(recordedImport(first, LOCAL, 'a.xlsx')?.importId).toBe('imp-1');
  });
});

describe('withResolvedImport', () => {
  it('moves a file to the survivor after a merge, keeping submittedAt', () => {
    const uploaded = withSubmission(
      emptyManifest(),
      LOCAL,
      'a.xlsx',
      'imp-new',
      AT,
    );

    const resolved = withResolvedImport(uploaded, LOCAL, 'a.xlsx', 'imp-old');

    expect(recordedImport(resolved, LOCAL, 'a.xlsx')).toEqual({
      importId: 'imp-old',
      submittedAt: AT.toISOString(),
    });
  });

  it('is a no-op for a file the manifest does not know', () => {
    const manifest = emptyManifest();
    expect(withResolvedImport(manifest, LOCAL, 'a.xlsx', 'imp-1')).toBe(
      manifest,
    );
  });
});

describe('planDrift', () => {
  it('is zero when the plan holds exactly the previewed rows', () => {
    expect(planDrift(['a', 'b'], ['b', 'a'])).toEqual({ added: 0, removed: 0 });
  });

  it('counts rows that appeared and rows that vanished', () => {
    expect(planDrift(['a', 'b', 'c'], ['a', 'd', 'e'])).toEqual({
      added: 2,
      removed: 2,
    });
  });
});
