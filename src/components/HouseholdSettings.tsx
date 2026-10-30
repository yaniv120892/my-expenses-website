'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import CopyableText from '@/components/CopyableText';
import {
  useChangeMemberRoleMutation,
  useCreateInviteMutation,
  useHouseholdQuery,
  useLeaveHouseholdMutation,
  useRemoveMemberMutation,
  useRevokeInviteMutation,
} from '@/hooks/useHouseholdQuery';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import {
  INVITE_CODE_PARAM,
  type HouseholdInviteView,
  type HouseholdMemberView,
  type HouseholdView,
  type InvitableRole,
} from '@/shared/types/household';
import { invitableRoleSchema } from '@/shared/schemas/household';
import { describeHouseholdError } from '@/utils/householdError';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

const INVITABLE_ROLES = invitableRoleSchema.options;

/** The owner manages members and invites; anyone else sees who is in and can leave. */
export default function HouseholdSettings() {
  const t = useT();
  const { data: household, isLoading, error } = useHouseholdQuery();

  if (isLoading) {
    return <CircularProgress size={24} />;
  }
  if (error || !household) {
    return (
      <Alert severity="error">
        {describeHouseholdError({ error, fallback: t('household.loadFailed'), t })}
      </Alert>
    );
  }
  return (
    <Stack spacing={3}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {t('household.intro')}
      </Typography>
      {household.role === 'OWNER' ? (
        <OwnerView household={household} />
      ) : (
        <MemberView household={household} />
      )}
    </Stack>
  );
}

function OwnerView({ household }: { household: HouseholdView }) {
  return (
    <>
      <MemberList members={household.members} manageable />
      <InviteCreator />
      <PendingInvites invites={household.invites} />
    </>
  );
}

function MemberView({ household }: { household: HouseholdView }) {
  const t = useT();
  const router = useRouter();
  const leaveMutation = useLeaveHouseholdMutation();
  const [confirming, setConfirming] = useState(false);

  function leave() {
    setConfirming(false);
    leaveMutation.mutate(undefined, {
      onSuccess: () => router.push('/dashboard'),
    });
  }

  return (
    <>
      <Typography>
        {t('household.memberOf', {
          owner: household.ownerName,
          role: t(`household.role.${household.role}`),
        })}
      </Typography>
      <MemberList members={household.members} manageable={false} />
      {leaveMutation.error && (
        <Alert severity="error">
          {describeHouseholdError({
            error: leaveMutation.error,
            fallback: t('household.leaveFailed'),
            t,
          })}
        </Alert>
      )}
      <Button
        color="error"
        variant="outlined"
        onClick={() => setConfirming(true)}
        disabled={leaveMutation.isPending}
        sx={{ alignSelf: 'flex-start' }}
      >
        {t('household.leave')}
      </Button>
      <ConfirmDialog
        open={confirming}
        text={t('household.leaveConfirm')}
        confirmLabel={t('household.leave')}
        onCancel={() => setConfirming(false)}
        onConfirm={leave}
      />
    </>
  );
}

function MemberList({
  members,
  manageable,
}: {
  members: HouseholdMemberView[];
  manageable: boolean;
}) {
  const t = useT();
  const roleMutation = useChangeMemberRoleMutation();
  const removeMutation = useRemoveMemberMutation();
  const [pendingRemoval, setPendingRemoval] = useState<HouseholdMemberView | null>(null);

  function changeRole(member: HouseholdMemberView, value: string) {
    if (isInvitableRole(value)) {
      roleMutation.mutate({ memberId: member.id, role: value });
    }
  }

  function confirmRemoval() {
    if (pendingRemoval) {
      removeMutation.mutate(pendingRemoval.id);
    }
    setPendingRemoval(null);
  }

  return (
    <Stack spacing={1}>
      <Typography variant="h6">{t('household.members')}</Typography>
      {roleMutation.error && (
        <Alert severity="error">
          {describeHouseholdError({
            error: roleMutation.error,
            fallback: t('household.roleChangeFailed'),
            t,
          })}
        </Alert>
      )}
      {removeMutation.error && (
        <Alert severity="error">
          {describeHouseholdError({
            error: removeMutation.error,
            fallback: t('household.removeFailed'),
            t,
          })}
        </Alert>
      )}
      <List dense disablePadding>
        {members.map((member) => {
          const canManage = manageable && member.role !== 'OWNER';
          return (
            <ListItem
              key={member.id}
              data-testid={`household-member-${member.username}`}
              disableGutters
              secondaryAction={
                canManage && (
                  <Tooltip title={t('household.remove')}>
                    <IconButton
                      edge="end"
                      aria-label={`${t('household.remove')} ${member.username}`}
                      onClick={() => setPendingRemoval(member)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                )
              }
            >
              <ListItemText
                primary={
                  member.isYou ? `${member.username} (${t('household.you')})` : member.username
                }
                secondary={member.email}
              />
              {canManage ? (
                <TextField
                  select
                  size="small"
                  value={member.role}
                  onChange={(event) => changeRole(member, event.target.value)}
                  slotProps={{
                    htmlInput: {
                      'aria-label': t('household.memberRole', { name: member.username }),
                    },
                  }}
                  sx={{ minWidth: 130, me: 6 }}
                >
                  {INVITABLE_ROLES.map((role) => (
                    <MenuItem key={role} value={role}>
                      {t(`household.role.${role}`)}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <Chip size="small" label={t(`household.role.${member.role}`)} />
              )}
            </ListItem>
          );
        })}
      </List>
      <ConfirmDialog
        open={pendingRemoval !== null}
        text={t('household.removeConfirm', { name: pendingRemoval?.username ?? '' })}
        confirmLabel={t('household.remove')}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={confirmRemoval}
      />
    </Stack>
  );
}

function InviteCreator() {
  const t = useT();
  const formatter = useAppFormat();
  const createMutation = useCreateInviteMutation();
  const [role, setRole] = useState<InvitableRole>('EDITOR');
  const [created, setCreated] = useState<HouseholdInviteView | null>(null);

  function selectRole(value: string) {
    if (isInvitableRole(value)) {
      setRole(value);
    }
  }

  function create() {
    createMutation.mutate(role, { onSuccess: (invite) => setCreated(invite) });
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h6">{t('household.invite.title')}</Typography>
      {createMutation.error && (
        <Alert severity="error">
          {describeHouseholdError({
            error: createMutation.error,
            fallback: t('household.invite.createFailed'),
            t,
          })}
        </Alert>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>
        <TextField
          select
          size="small"
          label={t('household.invite.role')}
          value={role}
          onChange={(event) => selectRole(event.target.value)}
          helperText={t(`household.roleHint.${role}`)}
          sx={{ minWidth: 200 }}
        >
          {INVITABLE_ROLES.map((option) => (
            <MenuItem key={option} value={option}>
              {t(`household.role.${option}`)}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="contained" onClick={create} disabled={createMutation.isPending}>
          {t('household.invite.create')}
        </Button>
      </Stack>
      {created && (
        <Stack spacing={1}>
          <CopyableText label={t('household.invite.link')} value={inviteLink(created.code)} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('household.invite.linkHint', { date: formatter.day(created.expiresAt) })}
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}

function PendingInvites({ invites }: { invites: HouseholdInviteView[] }) {
  const t = useT();
  const formatter = useAppFormat();
  const revokeMutation = useRevokeInviteMutation();
  const [pendingRevoke, setPendingRevoke] = useState<HouseholdInviteView | null>(null);

  function confirmRevoke() {
    if (pendingRevoke) {
      revokeMutation.mutate(pendingRevoke.id);
    }
    setPendingRevoke(null);
  }

  if (invites.length === 0) {
    return null;
  }
  return (
    <Stack spacing={1}>
      <Typography variant="h6">{t('household.invite.pending')}</Typography>
      {revokeMutation.error && (
        <Alert severity="error">
          {describeHouseholdError({
            error: revokeMutation.error,
            fallback: t('household.invite.revokeFailed'),
            t,
          })}
        </Alert>
      )}
      <List dense disablePadding>
        {invites.map((invite) => (
          <ListItem key={invite.id} disableGutters sx={{ flexWrap: 'wrap', columnGap: 1 }}>
            <ListItemText
              primary={t(`household.role.${invite.role}`)}
              secondary={t('household.invite.expires', { date: formatter.day(invite.expiresAt) })}
            />
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              <CopyInviteLinkButton code={invite.code} />
              <Button
                color="error"
                size="small"
                onClick={() => setPendingRevoke(invite)}
                disabled={revokeMutation.isPending}
              >
                {t('household.invite.revoke')}
              </Button>
            </Stack>
          </ListItem>
        ))}
      </List>
      <ConfirmDialog
        open={pendingRevoke !== null}
        text={t('household.invite.revokeConfirm')}
        confirmLabel={t('household.invite.revoke')}
        onCancel={() => setPendingRevoke(null)}
        onConfirm={confirmRevoke}
      />
    </Stack>
  );
}

/** Where the clipboard is refused, the link is shown instead so it can be copied by hand. */
function CopyInviteLinkButton({ code }: { code: string }) {
  const t = useT();
  const link = inviteLink(code);
  const { copyState, copy } = useCopyToClipboard(link);

  if (copyState === 'failed') {
    return <CopyableText label={t('household.invite.link')} value={link} />;
  }
  return (
    <Button size="small" startIcon={<ContentCopyIcon />} onClick={copy}>
      {copyState === 'copied' ? t('common.copied') : t('household.invite.copyLink')}
    </Button>
  );
}

function ConfirmDialog({
  open,
  text,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  text: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogContent>
        <DialogContentText>{text}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
        <Button color="error" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function inviteLink(code: string): string {
  return `${window.location.origin}/join?${INVITE_CODE_PARAM}=${encodeURIComponent(code)}`;
}

function isInvitableRole(value: string): value is InvitableRole {
  return invitableRoleSchema.safeParse(value).success;
}
