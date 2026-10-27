import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DOT_ENV_DATABASE = 'postgresql://u:p@127.0.0.1:1/from-dot-env';
const OTHER_FILE_DATABASE = 'postgresql://u:p@127.0.0.1:2/from-dotenv-path';
const PRESET_DATABASE = 'postgresql://u:p@127.0.0.1:3/preset';

async function loadDatasourceUrl(): Promise<string | undefined> {
  vi.resetModules();
  const { default: prismaConfig } = await import('./prisma.config');
  return prismaConfig.datasource?.url;
}

describe('prisma.config.ts', () => {
  const originalCwd = process.cwd();
  let workDir: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-config-'));
    fs.writeFileSync(path.join(workDir, '.env'), `DIRECT_URL=${DOT_ENV_DATABASE}\n`);
    fs.writeFileSync(path.join(workDir, 'other.env'), `DIRECT_URL=${OTHER_FILE_DATABASE}\n`);
    process.chdir(workDir);
    vi.stubEnv('DOTENV_PATH', path.join(workDir, 'other.env'));
    vi.stubEnv('DOTENV_OVERRIDE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.chdir(originalCwd);
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('keeps a preset DIRECT_URL when the environment asks dotenv to override', async () => {
    vi.stubEnv('DIRECT_URL', PRESET_DATABASE);

    expect(await loadDatasourceUrl()).toBe(PRESET_DATABASE);
  });

  it('reads .env rather than the file DOTENV_PATH names', async () => {
    vi.stubEnv('DIRECT_URL', undefined);

    expect(await loadDatasourceUrl()).toBe(DOT_ENV_DATABASE);
  });
});
