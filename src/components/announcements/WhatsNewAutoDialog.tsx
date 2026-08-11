'use client';

import { useMemo, useState } from 'react';
import WhatsNewDialog from '@/components/announcements/WhatsNewDialog';
import {
  useAcknowledgeAnnouncementsMutation,
  useAnnouncementsQuery,
} from '@/hooks/useAnnouncementsQuery';

/**
 * Shows unacknowledged announcements once, app-wide. Rendered in the
 * authenticated layout so it does not depend on which page the user landed on.
 */
export default function WhatsNewAutoDialog() {
  const { data: announcements } = useAnnouncementsQuery();
  const { mutate: acknowledge } = useAcknowledgeAnnouncementsMutation();
  const [dismissed, setDismissed] = useState(false);

  const unseen = useMemo(
    () => (announcements ?? []).filter((announcement) => !announcement.seen),
    [announcements],
  );

  function handleAcknowledge() {
    // Closed optimistically and the write runs in the background: trapping the
    // user behind a failed request would be worse than showing this again.
    setDismissed(true);
    acknowledge(unseen.map((announcement) => announcement.id));
  }

  return (
    <WhatsNewDialog
      open={!dismissed && unseen.length > 0}
      announcements={unseen}
      requireAcknowledgement
      onAcknowledge={handleAcknowledge}
      onClose={handleAcknowledge}
    />
  );
}
