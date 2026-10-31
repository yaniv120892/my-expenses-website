import { useState } from 'react';

type CopyState = 'idle' | 'copied' | 'failed';

export const COPY_STATE_KEYS = {
  idle: 'common.copy',
  copied: 'common.copied',
  failed: 'common.copyFailed',
} as const satisfies Record<CopyState, string>;

export function useCopyToClipboard(value: string) {
  const [copyState, setCopyState] = useState<CopyState>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  return { copyState, copy };
}
