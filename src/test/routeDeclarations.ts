import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const API_DIR = join(process.cwd(), 'src/app/api');

/**
 * Every handler under src/app/api that declares `option`, as
 * "METHOD route/path/route.ts → value". Reads the source, so a ledger test can
 * hold the set of handlers declaring an option equal to a reviewed list.
 */
export function declaredHandlerOptions(option: string): string[] {
  const declaration = new RegExp(`\\b${option}\\s*:\\s*([^,\\n}]+)`);
  return routeFiles(API_DIR)
    .flatMap((path) => declarationsIn({ path, declaration }))
    .sort();
}

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return routeFiles(path);
    }
    return entry.name === 'route.ts' ? [path] : [];
  });
}

function declarationsIn({ path, declaration }: { path: string; declaration: RegExp }): string[] {
  const route = relative(API_DIR, path);
  return readFileSync(path, 'utf8')
    .split(/^export const /m)
    .slice(1)
    .flatMap((handler) => {
      const value = declaration.exec(handler)?.[1]?.trim();
      const method = handler.slice(0, handler.indexOf(' '));
      return value ? [`${method} ${route} → ${value}`] : [];
    });
}
