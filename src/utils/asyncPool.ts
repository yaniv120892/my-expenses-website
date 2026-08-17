/**
 * Runs `worker` over `items` with at most `limit` in flight. Never rejects: a
 * failing worker settles as a rejected result so one bad item cannot abort the
 * rest of the batch. Results keep the input order.
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  const workerCount = Math.max(1, Math.min(limit, items.length));
  let nextIndex = 0;

  const runners = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        results[index] = {
          status: 'fulfilled',
          value: await worker(items[index], index),
        };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  });

  await Promise.all(runners);

  return results;
}
