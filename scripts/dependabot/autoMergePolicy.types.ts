// The `updateType` values dependabot/fetch-metadata emits.
export type UpdateType =
  | 'version-update:semver-major'
  | 'version-update:semver-minor'
  | 'version-update:semver-patch';

// An entry of dependabot/fetch-metadata's `updated-dependencies-json`.
export type UpdatedDependency = {
  dependencyName: string;
  updateType: string | null;
  prevVersion?: string | null;
};

// An entry of `GET /repos/{owner}/{repo}/rules/branches/{branch}`.
export type BranchRule = {
  type: string;
  parameters?: { required_status_checks?: { context: string }[] };
};

export type AutoMergeDecision = {
  merge: boolean;
  reason: string;
};
