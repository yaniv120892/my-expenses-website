// Run by .github/workflows/dependabot-auto-merge.yml from the base branch's
// checkout, never the pull request's, so a PR cannot rewrite its own verdict.
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type {
  AutoMergeDecision,
  BranchRule,
  UpdatedDependency,
  UpdateType,
} from './autoMergePolicy.types';

const REQUIRED_CHECKS = ['checks', 'e2e'];

const AUTO_MERGE_BY_UPDATE_TYPE = {
  'version-update:semver-major': false,
  'version-update:semver-minor': true,
  'version-update:semver-patch': true,
} satisfies Record<UpdateType, boolean>;

export function decideAutoMerge(
  dependencies: UpdatedDependency[],
  branchRules: BranchRule[],
): AutoMergeDecision {
  if (dependencies.length === 0) {
    return {
      merge: false,
      reason: 'no dependency metadata: not a verified Dependabot PR',
    };
  }
  const blocked = dependencies.filter(
    (dependency) => !isAutoMergeable(dependency),
  );
  if (blocked.length > 0) {
    const blockedLabels = blocked.map(
      (dependency) =>
        `${dependency.dependencyName} (${dependency.updateType ?? 'unknown'})`,
    );
    return {
      merge: false,
      reason: `needs manual review: ${blockedLabels.join(', ')}`,
    };
  }
  // With no required check, GitHub's auto-merge would merge before CI finishes.
  const requiredChecks = new Set(
    branchRules
      .filter((rule) => rule.type === 'required_status_checks')
      .flatMap((rule) => rule.parameters?.required_status_checks ?? [])
      .map((check) => check.context),
  );
  const missingChecks = REQUIRED_CHECKS.filter(
    (check) => !requiredChecks.has(check),
  );
  if (missingChecks.length > 0) {
    return {
      merge: false,
      reason: `base branch does not require: ${missingChecks.join(', ')}`,
    };
  }
  const names = dependencies.map((dependency) => dependency.dependencyName);
  return { merge: true, reason: `patch/minor only: ${names.join(', ')}` };
}

function isAutoMergeable(dependency: UpdatedDependency): boolean {
  const { updateType, prevVersion } = dependency;
  if (!isKnownUpdateType(updateType) || !prevVersion) {
    return false;
  }
  return (
    AUTO_MERGE_BY_UPDATE_TYPE[updateType] &&
    !isPreOneBreakingBump(updateType, prevVersion)
  );
}

// Below 1.0 a caret range treats a 0.x minor, and a 0.0.x patch, as breaking.
function isPreOneBreakingBump(
  updateType: UpdateType,
  prevVersion: string,
): boolean {
  const version = prevVersion.replace(/^v/, '');
  switch (updateType) {
    case 'version-update:semver-minor':
      return version.startsWith('0.');
    case 'version-update:semver-patch':
      return version.startsWith('0.0.');
    default:
      return false;
  }
}

function isKnownUpdateType(
  updateType: string | null,
): updateType is UpdateType {
  return (
    updateType !== null && Object.hasOwn(AUTO_MERGE_BY_UPDATE_TYPE, updateType)
  );
}

function main(): void {
  const dependencies: UpdatedDependency[] = JSON.parse(
    process.env.UPDATED_DEPENDENCIES || '[]',
  );
  const branchRules: BranchRule[] = JSON.parse(
    process.env.BRANCH_RULES || '[]',
  );
  const decision = decideAutoMerge(dependencies, branchRules);
  process.stdout.write(`auto-merge: ${decision.merge} — ${decision.reason}\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `merge=${decision.merge}\n`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
