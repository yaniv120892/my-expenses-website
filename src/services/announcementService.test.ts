import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  acknowledgeAnnouncementsSchema,
  MAX_ACKNOWLEDGE_IDS,
} from '@/shared/schemas/announcements';

const post = vi.fn();
vi.mock('./api', () => ({
  default: { post: (...args: unknown[]) => post(...args) },
}));

const { acknowledgeAnnouncements } = await import('./announcementService');

function sentBodies(): { ids: string[] }[] {
  return post.mock.calls.map((call) => call[1]);
}

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `announcement-${i}`);
}

describe('acknowledgeAnnouncements', () => {
  beforeEach(() => {
    post.mockReset();
    post.mockImplementation((_url, body: { ids: string[] }) =>
      Promise.resolve({ data: { acknowledged: body.ids } }),
    );
  });

  it('sends a single request when the set fits', async () => {
    const acknowledged = await acknowledgeAnnouncements(ids(3));

    expect(sentBodies()).toEqual([{ ids: ids(3) }]);
    expect(acknowledged).toEqual(ids(3));
  });

  // Regression: every unseen id went out in one request, so a user with more
  // than MAX_ACKNOWLEDGE_IDS unseen announcements got a 400 and — because the
  // write is fire-and-forget — saw the dialog again on every load.
  it('splits an oversized set into accepted batches', async () => {
    const all = ids(MAX_ACKNOWLEDGE_IDS * 2 + 7);

    const acknowledged = await acknowledgeAnnouncements(all);

    expect(sentBodies().map((body) => body.ids.length)).toEqual([
      MAX_ACKNOWLEDGE_IDS,
      MAX_ACKNOWLEDGE_IDS,
      7,
    ]);
    expect(acknowledged).toEqual(all);
    for (const body of sentBodies()) {
      expect(acknowledgeAnnouncementsSchema.safeParse(body).success).toBe(true);
    }
  });

  it('sends nothing when there is nothing to acknowledge', async () => {
    const acknowledged = await acknowledgeAnnouncements([]);

    // An empty batch would fail the schema's min(1), so it must not be sent.
    expect(post).not.toHaveBeenCalled();
    expect(acknowledged).toEqual([]);
  });
});
