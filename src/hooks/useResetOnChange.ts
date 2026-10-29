import { useState } from 'react';

// The render-time form of `useEffect(reset, deps)`, including the first render: it saves the extra
// commit an effect's setState costs.
export function useResetOnChange({
  deps,
  reset,
}: {
  deps: readonly unknown[];
  reset: () => void;
}): void {
  const [previousDeps, setPreviousDeps] = useState<readonly unknown[] | null>(null);
  const changed =
    previousDeps === null || deps.some((dep, index) => !Object.is(dep, previousDeps[index]));
  if (changed) {
    setPreviousDeps(deps);
    reset();
  }
}
