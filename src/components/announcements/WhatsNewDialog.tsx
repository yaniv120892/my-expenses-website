'use client';

import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { useIsCompact } from '@/hooks/useBreakpoints';
import {
  AnnouncementIcon,
  AnnouncementItem,
  AnnouncementWithSeen,
} from '@/shared/types/announcement';

const ICONS: Record<AnnouncementIcon, typeof AutoAwesomeRoundedIcon> = {
  compare: BarChartRoundedIcon,
  email: MarkEmailReadOutlinedIcon,
  category: GroupsOutlinedIcon,
  attachment: AttachFileRoundedIcon,
  sparkle: AutoAwesomeRoundedIcon,
};

interface Props {
  open: boolean;
  announcements: AnnouncementWithSeen[];
  // When true the only way out is the action button — no Escape, no backdrop.
  // Used for the automatic first showing; the drawer launcher opens it false.
  requireAcknowledgement: boolean;
  onAcknowledge: () => void;
  onClose: () => void;
}

function ItemRow({
  item,
  onNavigate,
}: {
  item: AnnouncementItem;
  onNavigate: (href: string) => void;
}) {
  const Icon = ICONS[item.icon];

  return (
    <Stack direction="row" spacing={1.75} alignItems="flex-start">
      <Box
        sx={(theme) => ({
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(theme.palette.primary.main, 0.12),
          color: 'primary.main',
        })}
      >
        <Icon fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ flexWrap: 'wrap' }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            {item.headline}
          </Typography>
          {item.tag && <Chip label={item.tag} size="small" color="primary" />}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {item.body}
        </Typography>
        {item.cta && (
          <Button
            size="small"
            onClick={() => onNavigate(item.cta!.href)}
            sx={{ mt: 0.75, ml: -1 }}
          >
            {item.cta.label}
          </Button>
        )}
      </Box>
    </Stack>
  );
}

export default function WhatsNewDialog({
  open,
  announcements,
  requireAcknowledgement,
  onAcknowledge,
  onClose,
}: Props) {
  const fullScreen = useIsCompact();
  const router = useRouter();

  if (announcements.length === 0) {
    return null;
  }

  // Acting on an announcement counts as reading it, so a CTA acknowledges too.
  function handleNavigate(href: string) {
    onAcknowledge();
    router.push(href);
  }

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (requireAcknowledgement && reason === 'backdropClick') {
          return;
        }
        onClose();
      }}
      disableEscapeKeyDown={requireAcknowledgement}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
      aria-labelledby="whats-new-title"
    >
      <DialogTitle id="whats-new-title" sx={{ pb: 0.5 }}>
        {announcements[0].title}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          {announcements.map((announcement, index) => (
            <Stack key={announcement.id} spacing={2}>
              {index > 0 && (
                <Typography variant="h6" sx={{ mt: 1 }}>
                  {announcement.title}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                {announcement.hook}
              </Typography>
              <Stack spacing={2.5}>
                {announcement.items.map((item) => (
                  <ItemRow
                    key={item.headline}
                    item={item}
                    onNavigate={handleNavigate}
                  />
                ))}
              </Stack>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="contained" onClick={onAcknowledge}>
          {requireAcknowledgement ? 'Got it' : 'Close'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
