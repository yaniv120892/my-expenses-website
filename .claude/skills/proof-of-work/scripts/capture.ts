/**
 * Captures proof-of-work screenshots against a locally running app.
 *
 * The session cookie is planted directly (same trick as `e2e/helpers.ts`) so a
 * capture never depends on the login form rendering correctly, and dark mode is
 * seeded into localStorage before first paint so there is no light-mode flash.
 *
 *   E2E_AUTH_TOKEN=$TOKEN npx tsx capture.ts --route /subscriptions \
 *     --name subscriptions-edit --dark
 *
 * Writes proof-of-work/<name>-{desktop,mobile}[-dark].png — a gitignored
 * directory, because screenshots are published from the proof-of-work-assets
 * branch and must never land in the PR's own diff.
 */
import { chromium, Browser, Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const OUT_DIR = path.resolve(process.env.PROOF_OF_WORK_DIR || 'proof-of-work');
const MODE_STORAGE_KEY = 'mui-mode';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

interface Options {
  route: string;
  name: string;
  dark: boolean;
  fullPage: boolean;
  viewports: (keyof typeof VIEWPORTS)[];
  waitFor?: string;
  clicks: string[];
  settleMs: number;
}

function parseArgs(argv: string[]): Options {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };

  // Repeatable, so a capture can walk into a dialog or a tab before shooting.
  const getAll = (flag: string): string[] =>
    argv.reduce<string[]>(
      (found, arg, i) =>
        arg === flag && argv[i + 1] ? [...found, argv[i + 1]] : found,
      [],
    );

  const route = get('--route');
  const name = get('--name');
  if (!route || !name) {
    throw new Error(
      'Usage: capture.ts --route /path --name kebab-name [--dark] [--full-page] [--wait-for <selector>] [--only desktop|mobile]',
    );
  }

  const only = get('--only') as keyof typeof VIEWPORTS | undefined;
  return {
    route,
    name,
    dark: argv.includes('--dark'),
    fullPage: argv.includes('--full-page'),
    viewports: only ? [only] : ['desktop', 'mobile'],
    waitFor: get('--wait-for'),
    clicks: getAll('--click'),
    settleMs: Number(get('--settle') ?? 1800),
  };
}

async function newPage(
  browser: Browser,
  viewport: { width: number; height: number },
  mode: 'light' | 'dark',
): Promise<Page> {
  const context = await browser.newContext({ viewport });

  const token = process.env.E2E_AUTH_TOKEN;
  if (token) {
    await context.addCookies([
      {
        name: 'session',
        value: token,
        domain: new URL(BASE_URL).hostname,
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  }

  const page = await context.newPage();
  await page.addInitScript(
    ([key, value]: [string, string]) => window.localStorage.setItem(key, value),
    [MODE_STORAGE_KEY, mode] as [string, string],
  );
  return page;
}

async function capture(browser: Browser, opts: Options): Promise<void> {
  const modes: ('light' | 'dark')[] = opts.dark ? ['light', 'dark'] : ['light'];

  for (const mode of modes) {
    for (const viewportName of opts.viewports) {
      const page = await newPage(browser, VIEWPORTS[viewportName], mode);

      await page.goto(`${BASE_URL}${opts.route}`, { waitUntil: 'networkidle' });
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
      const file = path.join(
        OUT_DIR,
        `${opts.name}-${viewportName}${suffix}.png`,
      );
      await page.screenshot({ path: file, fullPage: opts.fullPage });
      console.log(`wrote ${path.relative(process.cwd(), file)}`);

      await page.context().close();
    }
  }
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
  if (!root || !existsSync(root)) return undefined;

  const build = readdirSync(root)
    .filter((entry) => /^chromium-\d+$/.test(entry))
    .sort()
    .pop();
  if (!build) return undefined;

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
