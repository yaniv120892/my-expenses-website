'use client';

import { useState } from 'react';
import { Badge, IconButton, Tooltip } from '@mui/material';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import WhatsNewDialog from '@/components/announcements/WhatsNewDialog';
import {
  useAcknowledgeAnnouncementsMutation,
  useAnnouncementsQuery,
} from '@/hooks/useAnnouncementsQuery';

export default function WhatsNewLauncher() {
  const { data: announcements = [] } = useAnnouncementsQuery();
  const { mutate: acknowledge } = useAcknowledgeAnnouncementsMutation();
  const [open, setOpen] = useState(false);

  const unseenCount = announcements.filter(
    (announcement) => !announcement.seen,
  ).length;

  if (announcements.length === 0) {
    return null;
  }

  function handleAcknowledge() {
    setOpen(false);
    const unseenIds = announcements
      .filter((announcement) => !announcement.seen)
      .map((announcement) => announcement.id);
    if (unseenIds.length > 0) {
      acknowledge(unseenIds);
    }
  }

  return (
    <>
      <Tooltip title="What's new">
        <IconButton
          size="small"
          onClick={() => setOpen(true)}
          aria-label="What's new"
        >
          <Badge badgeContent={unseenCount} color="error" max={99}>
            <CampaignOutlinedIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>
      <WhatsNewDialog
        open={open}
        announcements={announcements}
        requireAcknowledgement={false}
        onAcknowledge={handleAcknowledge}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
