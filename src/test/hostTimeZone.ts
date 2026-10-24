import { onTestFinished } from 'vitest';

/**
 * Runs the current test as if the host were in `timeZone`: Node re-reads `TZ`
 * whenever it is assigned, so local-time formatting follows it at once.
 */
export function setHostTimeZone(timeZone: string): void {
  const original = process.env.TZ;
  process.env.TZ = timeZone;
  onTestFinished(() => {
    if (original === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = original;
    }
  });
}
