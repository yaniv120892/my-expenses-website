import { describe, it, expect } from 'vitest';
import { runWithConcurrency } from '@/utils/asyncPool';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('runWithConcurrency', () => {
  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;

    await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], 2, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight--;
    });

    expect(peak).toBe(2);
  });

  it('keeps input order in the results', async () => {
    const results = await runWithConcurrency(['a', 'b', 'c'], 3, async (item) =>
      item.toUpperCase(),
    );

    expect(results).toEqual([
      { status: 'fulfilled', value: 'A' },
      { status: 'fulfilled', value: 'B' },
      { status: 'fulfilled', value: 'C' },
    ]);
  });

  it('lets the remaining items finish when one worker rejects', async () => {
    const results = await runWithConcurrency([1, 2, 3], 2, async (item) => {
      if (item === 2) throw new Error('boom');
      return item;
    });

    expect(results[0]).toEqual({ status: 'fulfilled', value: 1 });
    expect(results[1].status).toBe('rejected');
    expect(results[2]).toEqual({ status: 'fulfilled', value: 3 });
  });

  it('starts the next item as soon as a slot frees', async () => {
    const first = deferred<string>();
    const started: number[] = [];

    const run = runWithConcurrency([0, 1, 2], 1, async (item) => {
      started.push(item);
      if (item === 0) return first.promise;
      return 'done';
    });

    await Promise.resolve();
    expect(started).toEqual([0]);

    first.resolve('done');
    await run;

    expect(started).toEqual([0, 1, 2]);
  });

  it('handles an empty list and a limit above the item count', async () => {
    expect(await runWithConcurrency([], 3, async () => 1)).toEqual([]);

    const results = await runWithConcurrency([1, 2], 10, async (item) => item);
    expect(results).toHaveLength(2);
  });
});
