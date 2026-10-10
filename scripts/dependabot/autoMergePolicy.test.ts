import { describe, expect, it } from 'vitest';
import { decideAutoMerge } from './autoMergePolicy';
import type { BranchRule, UpdatedDependency } from './autoMergePolicy.types';

const requiresCi: BranchRule[] = [
  { type: 'pull_request' },
  {
    type: 'required_status_checks',
    parameters: {
      required_status_checks: [{ context: 'checks' }, { context: 'e2e' }],
    },
  },
];

function dependency(
  dependencyName: string,
  updateType: string | null,
  prevVersion: string | null = '1.2.3',
): UpdatedDependency {
  return { dependencyName, updateType, prevVersion };
}

describe('decideAutoMerge', () => {
  it('merges a grouped PR of patch and minor updates once CI is required', () => {
    const grouped = [
      dependency('nodemailer', 'version-update:semver-patch'),
      dependency('next', 'version-update:semver-minor'),
      dependency('eslint-config-next', 'version-update:semver-minor'),
    ];

    expect(decideAutoMerge(grouped, requiresCi)).toEqual({
      merge: true,
      reason: 'patch/minor only: nodemailer, next, eslint-config-next',
    });
  });

  it('leaves a major update for review', () => {
    const decision = decideAutoMerge(
      [dependency('dotenv', 'version-update:semver-major')],
      requiresCi,
    );

    expect(decision).toEqual({
      merge: false,
      reason: 'needs manual review: dotenv (version-update:semver-major)',
    });
  });

  it('leaves a mixed PR for review when any member is a major', () => {
    const mixed = [
      dependency('nodemailer', 'version-update:semver-patch'),
      dependency('googleapis', 'version-update:semver-major'),
    ];

    expect(decideAutoMerge(mixed, requiresCi).merge).toBe(false);
  });

  it('leaves an update of unknown type for review', () => {
    const decision = decideAutoMerge(
      [dependency('actions/checkout', null)],
      requiresCi,
    );

    expect(decision).toEqual({
      merge: false,
      reason: 'needs manual review: actions/checkout (unknown)',
    });
  });

  it('leaves an unrecognised update type for review, even one naming an object key', () => {
    const decision = decideAutoMerge(
      [dependency('left-pad', 'toString')],
      requiresCi,
    );

    expect(decision.merge).toBe(false);
  });

  it('leaves a 0.x minor for review, since below 1.0 a minor may break', () => {
    const preOne = {
      dependencyName: '@google/generative-ai',
      updateType: 'version-update:semver-minor',
      prevVersion: '0.24.1',
    };

    expect(decideAutoMerge([preOne], requiresCi).merge).toBe(false);
  });

  it('leaves a 0.0.x patch for review, since a caret range treats it as breaking', () => {
    const preOnePatch = dependency(
      'tiny-lib',
      'version-update:semver-patch',
      '0.0.4',
    );

    expect(decideAutoMerge([preOnePatch], requiresCi).merge).toBe(false);
  });

  it('leaves an update with no previous version for review, since its range cannot be judged', () => {
    const unknownBase = dependency('next', 'version-update:semver-minor', null);

    expect(decideAutoMerge([unknownBase], requiresCi).merge).toBe(false);
  });

  it('merges a v-prefixed action minor above 1.0', () => {
    const action = dependency(
      'actions/checkout',
      'version-update:semver-minor',
      'v7.0.0',
    );

    expect(decideAutoMerge([action], requiresCi).merge).toBe(true);
  });

  it('refuses when fetch-metadata found no verified Dependabot dependencies', () => {
    expect(decideAutoMerge([], requiresCi).merge).toBe(false);
  });

  it('refuses while the base branch does not require CI, so a failing build cannot merge', () => {
    const patch = [dependency('nodemailer', 'version-update:semver-patch')];

    expect(decideAutoMerge(patch, [{ type: 'pull_request' }])).toEqual({
      merge: false,
      reason: 'base branch does not require: checks, e2e',
    });
  });

  it('refuses when only some of the CI jobs are required', () => {
    const onlyChecks: BranchRule[] = [
      {
        type: 'required_status_checks',
        parameters: { required_status_checks: [{ context: 'checks' }] },
      },
    ];

    expect(
      decideAutoMerge(
        [dependency('nodemailer', 'version-update:semver-patch')],
        onlyChecks,
      ),
    ).toEqual({
      merge: false,
      reason: 'base branch does not require: e2e',
    });
  });
});
