---
name: maintenance-crash-fuzz
description: Daily maintenance routine that runs the Playwright crash fuzzer against the running app, triages what it finds, and fixes one reproducible crash per PR. Use when running the scheduled fuzz sweep or when asked to hunt for UI crashes.
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

# Crash fuzzer triage

Drive the app at random looking for uncaught exceptions, 5xx responses, and
blank screens, then fix what is real. Read `docs/maintenance/pr-protocol.md`
first — backpressure, verification gate, and one-concern-per-PR all apply.

## Running the fuzzer

The e2e stack must already be up and `E2E_AUTH_TOKEN` exported (the scheduled
workflow does this; `test/e2e-api/README.md` covers doing it by hand).

```bash
npm run fuzz:crash -- --steps 300 --seed "$SEED" --max-minutes 10
```

Findings land in `fuzz-findings.json`. Vary `--seed` between runs — a fixed
seed re-walks the same path and finds the same nothing. Use the run date as
the seed unless reproducing an earlier finding.

Each finding carries the seed and the last 15 actions that led to it, so a
finding is replayable by re-running with the same `--seed`.

## Triage

Work through findings in this order, and **discard aggressively** — most raw
findings are not bugs.

1. **Reproduce.** Re-run with the reported seed. A finding that does not
   reproduce is not actionable; note it and drop it. Do not fix by inference.
2. **Classify the source.** A finding is only a bug if the app caused it:
   - `pageerror` — almost always real. Highest priority
   - `http5xx` — real; a 5xx is by definition the server failing to handle
     input, even input this daft
   - `blank-screen` — real if the app rendered nothing after a valid action;
     noise if the route was still compiling
   - `console` — mixed. React key warnings and act() noise are real but low
     value; third-party and network chatter is not the app's problem
   - `dialog` — usually the app's own confirm; rarely a bug
3. **Find the root cause.** Read the trail, reproduce by hand if needed, and
   fix the actual defect.

## Fixing

**Fix the cause, not the symptom.** A crash on a 5000-character description
means the input needs validation or the renderer needs to handle long strings —
not that the fuzzer should stop typing long strings.

**Never swallow the error.** A `try/catch` that discards, an optional-chain
that hides a missing object, or a silent early return all make the bug
invisible. `CLAUDE.md` is explicit that logs are the only error signal in this
app: anything caught must be logged through pino
(`logger.error({ err }, 'msg')`) or rethrown.

**Cover it with a test.** A fixed crash gets a regression test — a vitest unit
test for logic, or an `e2e/` spec for an interaction. The fuzzer finds bugs; it
does not keep them fixed.

**One crash per PR**, even when a run surfaces several.

## When the finding is the fuzzer's fault

Sometimes the fuzzer is wrong: it fuzzed a dev-only control, flagged
third-party console noise, or called a still-compiling route blank. Then the
fix belongs in `e2e/fuzz/crash-fuzz.ts` — tighten `isFuzzable`, the
`IGNORED_CONSOLE` list, or the readiness wait — and the PR says so plainly.

Be careful here: widening the ignore list is also how a fuzzer is quietly
turned off. Only ignore things that are provably not the app's behaviour, and
say in the PR what class of real bug the new filter could now hide.

## When a run finds nothing

That is a normal outcome and **not** a reason to open a PR. Report the seed and
step count so the next run can go further, and consider whether the routine
should explore more: more steps, a different seed, or a new interaction the
fuzzer cannot currently reach (file upload, drag, keyboard-only navigation).
Proposing that as a fuzzer improvement is a legitimate PR on its own.
