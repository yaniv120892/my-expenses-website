/**
 * Crash fuzzer: opens the app as a signed-in user and taps around at random,
 * looking for uncaught exceptions, console errors, 5xx responses, and blank
 * screens.
 *
 * Runs as a plain script rather than a Playwright spec so it stays out of
 * `npm run test:e2e:ui` — a fuzz run is exploratory and its failures are
 * findings to triage, not a red build. Every run is driven by a seeded PRNG
 * and records the action trail that led to each finding, so re-running with
 * the reported `--seed` replays it.
 *
 * Usage:
 *   E2E_AUTH_TOKEN=... npx tsx e2e/fuzz/crash-fuzz.ts --steps 200 --seed 12345
 */
import { chromium, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { signIn } from '../helpers';
import { APP_PAGES } from '../routes';

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

type Finding = {
  kind: 'pageerror' | 'console' | 'http5xx' | 'blank-screen' | 'dialog';
  message: string;
  url: string;
  seed: number;
  step: number;
  trail: Step[];
};

type Step = {
  step: number;
  action: string;
  target: string;
  value?: string;
  url: string;
};

type Candidate = {
  id: number;
  tag: string;
  type: string | null;
  label: string;
  href: string | null;
};

/** Deterministic PRNG — a finding is only actionable if the run replays. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FUZZ_VALUES = [
  '',
  '0',
  '-1',
  '-0',
  '1e309',
  '99999999999999999999',
  '0.000000001',
  'not a number',
  '2026-02-30',
  '   ',
  'א'.repeat(40),
  '🧾💸🙂',
  "'; DROP TABLE transactions; --",
  '<script>window.__fuzz=1</script>',
  '../../etc/passwd',
  'x'.repeat(5000),
];

const CANDIDATE_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'textarea',
  'select',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="combobox"]',
].join(', ');

/** Ending the session or leaving the origin wastes the rest of the run. */
const SKIP_LABELS = /log ?out|sign ?out|logout/i;

/**
 * Dev-server chatter that says nothing about the app's health. Kept
 * deliberately short — an over-broad ignore list is how a fuzzer goes quiet.
 */
const IGNORED_CONSOLE = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /favicon\.ico/i,
  /Extra attributes from the server/i,
];

function parseArgs(argv: string[]): {
  steps: number;
  seed: number;
  out: string;
  maxMinutes: number;
  failOnFindings: boolean;
} {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  return {
    steps: Number(get('steps') || 200),
    // Default seed is stable so a scheduled run is reproducible from its log.
    seed: Number(get('seed') || 1),
    out: resolve(get('out') || 'fuzz-findings.json'),
    // A step can stall on a slow route, so the step count alone does not bound
    // the run; the scheduled job needs a wall-clock stop.
    maxMinutes: Number(get('max-minutes') || 10),
    failOnFindings: argv.includes('--fail-on-findings'),
  };
}

/**
 * Tags every interactable element with `data-fuzz-id` and returns a descriptor
 * for each, so the fuzzer can act on an exact element rather than an nth-match
 * that may have shifted.
 *
 * Walks shadow roots by hand instead of leaning on Playwright's piercing CSS:
 * the Next.js dev overlay renders into `<nextjs-portal>`'s shadow root, and
 * fuzzing the dev tools instead of the app burns most of a run. MUI's drawers,
 * dialogs and menus are body-level portals, so the walk has to start at
 * `document` rather than at `<main>` or they would all be missed.
 */
async function collectCandidates(page: Page): Promise<Candidate[]> {
  // The body below declares no inner functions on purpose. tsx transpiles this
  // file with esbuild's keepNames, which wraps every named function in a
  // `__name(...)` helper — a helper that does not exist in the page context, so
  // an inner function here fails at runtime with `__name is not defined` and
  // takes the whole collection with it. Hence the explicit stack instead of a
  // recursive walk.
  return page.evaluate((selector) => {
    const SKIP_TAGS = ['NEXTJS-PORTAL', 'NEXT-ROUTE-ANNOUNCER'];
    const found: Candidate[] = [];
    const roots: (Document | ShadowRoot)[] = [document];
    let id = 0;

    while (roots.length > 0) {
      const root = roots.pop() as Document | ShadowRoot;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (SKIP_TAGS.indexOf(el.tagName) !== -1) continue;
        if (el.shadowRoot) roots.push(el.shadowRoot);
        el.removeAttribute('data-fuzz-id');
        if (!el.matches(selector)) continue;
        if ((el as HTMLInputElement).disabled) continue;

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') continue;

        el.setAttribute('data-fuzz-id', String(id));
        found.push({
          id,
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type'),
          label: (
            el.getAttribute('aria-label') ||
            el.textContent ||
            el.getAttribute('placeholder') ||
            el.getAttribute('name') ||
            ''
          )
            .trim()
            .slice(0, 60),
          href: el.getAttribute('href'),
        });
        id++;
      }
    }

    return found;
  }, CANDIDATE_SELECTOR);
}

function isFuzzable(candidate: Candidate): boolean {
  if (SKIP_LABELS.test(candidate.label)) return false;
  // Playwright cannot fill a file input, and a hidden one is not a real target.
  if (candidate.tag === 'input' && /^(file|hidden)$/.test(candidate.type || ''))
    return false;
  if (candidate.href) {
    if (candidate.href.startsWith('/api/')) return false;
    if (
      /^(https?:|mailto:|tel:)/i.test(candidate.href) &&
      !candidate.href.startsWith(BASE_URL)
    )
      return false;
  }
  return true;
}

async function main(): Promise<void> {
  const token = process.env.E2E_AUTH_TOKEN;
  if (!token) {
    console.error(
      'E2E_AUTH_TOKEN is required (test/e2e-api/serve.ts prints it)',
    );
    process.exit(1);
  }

  const { steps, seed, out, maxMinutes, failOnFindings } = parseArgs(
    process.argv.slice(2),
  );
  const deadline = Date.now() + maxMinutes * 60_000;
  const random = mulberry32(seed);
  const findings: Finding[] = [];
  const trail: Step[] = [];
  const seen = new Set<string>();

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await signIn(page, token);

  let step = 0;
  const record = (kind: Finding['kind'], message: string): void => {
    const key = `${kind}:${message.replace(/\d+/g, 'N').slice(0, 200)}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({
      kind,
      message: message.slice(0, 2000),
      url: page.url(),
      seed,
      step,
      // The last 15 actions are enough to replay without burying the report.
      trail: trail.slice(-15),
    });
    console.log(`[finding] ${kind} @ step ${step}: ${message.slice(0, 160)}`);
  };

  page.on('pageerror', (error) =>
    record('pageerror', `${error.name}: ${error.message}`),
  );
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    // A third-party script failing to load (analytics, fonts) is the network's
    // problem, not the app's; only same-origin failures are findings.
    const from = msg.location().url;
    if (from && !from.startsWith(BASE_URL) && /^https?:/i.test(from)) return;
    record('console', text);
  });
  page.on('response', (res) => {
    if (res.status() >= 500 && res.url().startsWith(BASE_URL)) {
      record(
        'http5xx',
        `${res.status()} ${res.request().method()} ${res.url()}`,
      );
    }
  });
  // An unhandled dialog blocks every later action, so answer and report it.
  page.on('dialog', (dialog) => {
    record('dialog', `${dialog.type()}: ${dialog.message()}`);
    void dialog.dismiss().catch(() => {});
  });
  context.on('page', (popup) => void popup.close().catch(() => {}));

  /**
   * Polls until the page has something to interact with. A fixed sleep is not
   * enough: the dev server compiles each route on first visit, and treating a
   * still-compiling page as empty turns the whole run into a walk of `goto`s.
   */
  const collectReady = async (timeoutMs = 8_000): Promise<Candidate[]> => {
    const until = Date.now() + timeoutMs;
    let lastError: unknown;
    for (;;) {
      try {
        const list = (await collectCandidates(page)).filter(isFuzzable);
        if (list.length > 0) return list;
        lastError = undefined;
      } catch (error) {
        lastError = error;
      }
      if (Date.now() >= until) {
        // A collector that never succeeded is a broken fuzzer, not an app with
        // nothing on screen. Reporting it as a finding would be a confident
        // lie, so fail the run instead.
        if (lastError) {
          throw new Error(
            `candidate collection kept failing: ${(lastError as Error).message}`,
          );
        }
        return [];
      }
      await page.waitForTimeout(250);
    }
  };

  const goToRandomPage = async (): Promise<void> => {
    const { path } = APP_PAGES[Math.floor(random() * APP_PAGES.length)];
    await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => {});
    trail.push({ step, action: 'goto', target: path, url: page.url() });
    await collectReady();
  };

  await goToRandomPage();

  for (step = 1; step <= steps; step++) {
    if (Date.now() > deadline) {
      console.log(`[budget] stopping at step ${step}: ${maxMinutes}m elapsed`);
      break;
    }

    // Periodically jump elsewhere so the crawl doesn't get stuck in one dialog.
    if (step % 25 === 0) {
      await goToRandomPage();
      continue;
    }

    const candidates = await collectReady();
    if (step % 10 === 0) {
      console.log(
        `[progress] step ${step}/${steps}, ${candidates.length} targets`,
      );
    }

    if (candidates.length === 0) {
      record('blank-screen', 'no interactable elements on the page');
      await goToRandomPage();
      continue;
    }

    const pick = candidates[Math.floor(random() * candidates.length)];
    const target = page.locator(`[data-fuzz-id="${pick.id}"]`);
    const value =
      pick.tag === 'input' || pick.tag === 'textarea'
        ? FUZZ_VALUES[Math.floor(random() * FUZZ_VALUES.length)]
        : undefined;

    try {
      if (value !== undefined) {
        await target.fill(value, { timeout: 3000 });
        if (random() < 0.5) await target.press('Enter', { timeout: 3000 });
      } else if (pick.tag === 'select') {
        await target.selectOption({ index: 0 }, { timeout: 3000 });
      } else {
        await target.click({ timeout: 3000 });
      }
      trail.push({
        step,
        action: value !== undefined ? 'fill' : 'click',
        target: `${pick.tag}[${pick.label}]`,
        value,
        url: page.url(),
      });
    } catch {
      // Not-clickable / detached / timed-out interactions are the fuzzer
      // bumping into the UI, not the app breaking.
      continue;
    }

    await page.waitForTimeout(120);

    const bodyText = await page
      .locator('body')
      .innerText({ timeout: 3000 })
      .catch(() => '');
    if (bodyText.trim().length === 0) {
      record('blank-screen', 'body rendered empty after action');
      await goToRandomPage();
    }
  }

  await browser.close();

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify({ seed, steps, findings }, null, 2) + '\n',
    'utf8',
  );

  console.log(
    `fuzz complete: seed=${seed} steps=${steps} findings=${findings.length} -> ${out}`,
  );
  if (failOnFindings && findings.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
