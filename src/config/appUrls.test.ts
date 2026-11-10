import { APP_IDS } from '@yaniv120892/my-ui';
import { describe, expect, it } from 'vitest';

import { APP_URLS } from './appUrls';

const THIS_APP = 'expenses';

describe('APP_URLS', () => {
  it('links to every sibling app and not to this one', () => {
    const siblings = APP_IDS.filter((appId) => appId !== THIS_APP);

    expect(Object.keys(APP_URLS).sort()).toEqual([...siblings].sort());
  });

  it('gives every sibling an https address', () => {
    for (const url of Object.values(APP_URLS)) {
      expect(new URL(url).protocol).toBe('https:');
    }
  });
});
