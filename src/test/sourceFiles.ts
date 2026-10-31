import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Every file under `directory` whose name `isWanted` accepts, skipping generated code. */
export function filesUnder(directory: string, isWanted: (fileName: string) => boolean): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'generated' ? [] : filesUnder(path, isWanted);
    }
    return isWanted(entry.name) ? [path] : [];
  });
}

export function isNonTestSource(fileName: string): boolean {
  const isSource = /\.tsx?$/.test(fileName);
  const isTest = /\.test(-d)?\.tsx?$/.test(fileName);
  return isSource && !isTest;
}
