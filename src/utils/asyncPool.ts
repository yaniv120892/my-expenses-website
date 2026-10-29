// Never rejects: a failing worker settles as a rejected result so one bad item
// cannot abort the rest. Results keep the input order.
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  const workerCount = Math.max(1, Math.min(limit, items.length));
  // One iterator shared by every runner, so each item is taken exactly once.
  const pending = items.entries();

  const runners = Array.from({ length: workerCount }, async () => {
    for (const [index, item] of pending) {
      try {
        results[index] = {
          status: 'fulfilled',
          value: await worker(item, index),
        };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  });

  await Promise.all(runners);

  return results;
}
