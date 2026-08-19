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
 * Writes docs/proof-of-work/<name>-{desktop,mobile}[-dark].png.
 */
import { chromium, Browser, Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const OUT_DIR = path.resolve('docs/proof-of-work');
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
}

function parseArgs(argv: string[]): Options {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };

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
      if (opts.waitFor) {
        await page.waitForSelector(opts.waitFor, { timeout: 15_000 });
      }

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

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
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
