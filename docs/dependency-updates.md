# Dependency updates

Load before changing `.github/dependabot.yml`, `.github/workflows/dependabot-auto-merge.yml` or
`scripts/dependabot/autoMergePolicy.ts`, or when deciding whether a Dependabot PR needs a human.

Dependabot (`.github/dependabot.yml`) is the only dependency updater. Routine version updates are
weekly, minors and patches grouped per ecosystem and each major on its own — a lockstep family's
majors together — behind a release-age cooldown and an open-PR cap. Security updates come from
Dependabot alerts as soon as an advisory lands, outside that schedule, cooldown and cap.

`.github/workflows/dependabot-auto-merge.yml` queues a squash auto-merge on a Dependabot PR whose
every dependency is a patch or minor (`scripts/dependabot/autoMergePolicy.ts`, read from the base
branch), and only while the base branch's ruleset requires the `checks / Quality gate` and `e2e`
checks; a major, a 0.x minor or 0.0.x patch, an unknown update type or previous version, or a
mixed PR waits for a human, and a later push that fails the policy withdraws a queued auto-merge.

Dependabot also raises `@yaniv120892/my-ui`'s release-tag bumps, and the policy judges them like
any other dependency's — a patch of the shared design merges on green CI unreviewed.
