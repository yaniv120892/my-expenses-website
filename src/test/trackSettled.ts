export function trackSettled<T>(work: Promise<T>): {
  pending: Promise<T>;
  isSettled: () => boolean;
} {
  let settled = false;
  const pending = (async () => {
    try {
      return await work;
    } finally {
      settled = true;
    }
  })();
  return {
    pending,
    isSettled: function isSettled() {
      return settled;
    },
  };
}
