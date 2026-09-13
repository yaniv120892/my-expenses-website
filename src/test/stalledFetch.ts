export function stalledFetch(
  _input: unknown,
  init?: { signal?: AbortSignal | null },
): Promise<never> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(new DOMException('The operation was aborted', 'AbortError'));
    });
  });
}
