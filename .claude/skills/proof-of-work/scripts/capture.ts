/**
 * Captures proof-of-work screenshots against a locally running app.
 *
 * Runs in place, so it shares `signIn()` with the e2e suite and a capture never
 * depends on the login form rendering. Dark mode is seeded into localStorage
 * before first paint so there is no light-mode flash.
 *
 *   E2E_AUTH_TOKEN=$TOKEN npx tsx .claude/skills/proof-of-work/scripts/capture.ts \
 *     --route /subscriptions --name subscriptions-edit --dark
 *
 * Writes proof-of-work/<name>-{desktop,mobile}[-dark].png — a gitignored
 * directory, because screenshots are published from the proof-of-work-assets
 * branch and must never land in the PR's own diff.
 */
import { chromium, Browser } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { signIn } from '../../../../e2e/helpers';

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const OUT_DIR = path.resolve(process.env.PROOF_OF_WORK_DIR || 'proof-of-work');

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

type ViewportName = keyof typeof VIEWPORTS;
type Mode = 'light' | 'dark';

interface Options {
  route: string;
  name: string;
  fullPage: boolean;
  viewports: ViewportName[];
  modes: Mode[];
  waitFor?: string;
  clicks: string[];
  settleMs: number;
}

const USAGE = `Usage: capture.ts --route /path --name kebab-name
  [--dark] [--full-page] [--only desktop|mobile]
  [--wait-for <selector>] [--click <selector>]... [--settle <ms>]`;

function parseViewports(only: string | undefined): ViewportName[] {
  if (only === undefined) {
    return ['desktop', 'mobile'];
  }
  if (only === 'desktop' || only === 'mobile') {
    return [only];
  }
  throw new Error(`--only takes desktop or mobile, got "${only}"\n${USAGE}`);
}

function parseArgs(argv: string[]): Options {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };

  // Repeatable, so a capture can walk into a dialog or a tab before shooting.
  const getAll = (flag: string): string[] =>
    argv.flatMap((arg, i) =>
      arg === flag && argv[i + 1] ? [argv[i + 1]] : [],
    );

  const route = get('--route');
  const name = get('--name');
  if (!route || !name) {
    throw new Error(USAGE);
  }

  return {
    route,
    name,
    fullPage: argv.includes('--full-page'),
    viewports: parseViewports(get('--only')),
    modes: argv.includes('--dark') ? ['light', 'dark'] : ['light'],
    waitFor: get('--wait-for'),
    clicks: getAll('--click'),
    settleMs: Number(get('--settle') ?? 1800),
  };
}

async function shoot(
  browser: Browser,
  opts: Options,
  mode: Mode,
  viewportName: ViewportName,
): Promise<void> {
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewportName],
  });
  const page = await context.newPage();

  const token = process.env.E2E_AUTH_TOKEN;
  if (token) {
    await signIn(page, token);
  }
  await page.addInitScript(
    (value: string) => window.localStorage.setItem('mui-mode', value),
    mode,
  );

  await page.goto(`${BASE_URL}${opts.route}`);
  for (const selector of opts.clicks) {
    await page.click(selector, { timeout: 15_000 });
  }
  if (opts.waitFor) {
    await page.waitForSelector(opts.waitFor, { timeout: 15_000 });
  }
  // Let animations finish. MUI transitions are ~300ms, but recharts runs a
  // 1500ms enter animation on every data change — shooting before it lands
  // catches sectors at zero radius and the chart reads as missing.
  await page.waitForTimeout(opts.settleMs);

  const suffix = mode === 'dark' ? '-dark' : '';
  const file = path.join(OUT_DIR, `${opts.name}-${viewportName}${suffix}.png`);
  await page.screenshot({ path: file, fullPage: opts.fullPage });
  console.log(`wrote ${path.relative(process.cwd(), file)}`);

  await context.close();
}

// Contexts are isolated, so the mode x viewport matrix shoots concurrently
// rather than paying the settle delay once per combination.
async function capture(browser: Browser, opts: Options): Promise<void> {
  await Promise.all(
    opts.modes.flatMap((mode) =>
      opts.viewports.map((viewportName) =>
        shoot(browser, opts, mode, viewportName),
      ),
    ),
  );
}

/**
 * Playwright only finds a browser under PLAYWRIGHT_BROWSERS_PATH when the
 * package version matches the installed build, which is not true of every
 * preinstalled image — so an explicit path is honoured first, then the newest
 * chromium in that directory, before letting Playwright look on its own.
 */
function resolveChromium(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  }
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) {
    return undefined;
  }

  // Sort on the build number, so chromium-1100 wins over chromium-999.
  const build = readdirSync(root)
    .map((entry) => /^chromium-(\d+)$/.exec(entry))
    .filter((match): match is RegExpExecArray => match !== null)
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .pop()?.[0];
  if (!build) {
    return undefined;
  }

  // Only the linux layout is worth handling: this exists for CI images, and a
  // dev machine falls through to Playwright's own lookup, which works there.
  const binary = path.join(root, build, 'chrome-linux', 'chrome');
  return existsSync(binary) ? binary : undefined;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const executablePath = resolveChromium();
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch(
    executablePath ? { executablePath } : {},
  );

  try {
    await capture(browser, opts);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
