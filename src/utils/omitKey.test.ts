import { describe, expect, it } from 'vitest';
import { omitKey } from '@/utils/omitKey';

describe('omitKey', () => {
  it('drops only the named key and leaves the input untouched', () => {
    const operations = { a: 'ignore', b: 'delete' };

    expect(omitKey({ record: operations, key: 'a' })).toEqual({ b: 'delete' });
    expect(omitKey({ record: operations, key: 'missing' })).toEqual({ a: 'ignore', b: 'delete' });
    expect(operations).toEqual({ a: 'ignore', b: 'delete' });
  });
});
