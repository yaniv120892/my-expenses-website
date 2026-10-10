// Run by .github/workflows/dependabot-auto-merge.yml from the base branch's
// checkout, never the pull request's, so a PR cannot rewrite its own verdict.
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type {
  AutoMergeDecision,
  BranchRule,
  UpdatedDependency,
} from './autoMergePolicy.types';

export const REQUIRED_CHECKS = ['checks', 'e2e'];

const AUTO_MERGE_UPDATE_TYPES = new Set([
  'version-update:semver-patch',
  'version-update:semver-minor',
]);

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
    (dependency) => !AUTO_MERGE_UPDATE_TYPES.has(dependency.updateType ?? ''),
  );
  if (blocked.length > 0) {
    const names = blocked.map(
      (dependency) =>
        `${dependency.dependencyName} (${dependency.updateType ?? 'unknown'})`,
    );
    return { merge: false, reason: `needs manual review: ${names.join(', ')}` };
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

function main(): void {
  const dependencies: UpdatedDependency[] = JSON.parse(
    process.env.UPDATED_DEPENDENCIES || '[]',
  );
  const branchRules: BranchRule[] = JSON.parse(
    readFileSync(process.env.BRANCH_RULES_FILE ?? '', 'utf8'),
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
