import { describe, expect, it } from 'vitest';
import { withVerifyFullSslMode } from '@/server/db/sslMode';

const NEON =
  'postgresql://owner:p%40ss@ep-x-pooler.eu-central-1.aws.neon.tech/neondb';

describe('withVerifyFullSslMode', () => {
  it.each(['require', 'prefer'])('pins sslmode=%s to verify-full', (mode) => {
    const pinned = new URL(
      withVerifyFullSslMode(`${NEON}?sslmode=${mode}&channel_binding=require`),
    );
    expect(pinned.searchParams.get('sslmode')).toBe('verify-full');
    expect(pinned.searchParams.get('channel_binding')).toBe('require');
    expect(pinned.password).toBe('p%40ss');
  });

  it.each([
    NEON,
    `${NEON}?sslmode=disable`,
    `${NEON}?sslmode=verify-ca`,
    `${NEON}?sslmode=verify-full`,
    'not a url',
  ])('leaves %s unchanged', (connectionString) => {
    expect(withVerifyFullSslMode(connectionString)).toBe(connectionString);
  });
});
