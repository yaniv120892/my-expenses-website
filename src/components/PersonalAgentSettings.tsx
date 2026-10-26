'use client';

import { useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  useApiTokensQuery,
  useCreateApiTokenMutation,
  useRevokeApiTokenMutation,
} from '@/hooks/useApiTokensQuery';
import type { ApiTokenSummary } from '@/types/apiToken';
import { buildAgentBriefing } from '@/utils/agentBriefing';
import { describeApiError } from '@/utils/api';
import { useAppFormat, type AppFormatter } from '@/i18n/useAppFormat';
import { useT, type T } from '@/i18n/useT';
import CopyableText from '@/components/CopyableText';
import RevokeTokenDialog from '@/components/RevokeTokenDialog';

const DEFAULT_AGENT_NAME = 'Instinct';
const MCP_PATH = '/api/mcp';

const EXAMPLE_REQUEST_KEYS = [
  'settings.agent.example.coffee',
  'settings.agent.example.netflix',
  'settings.agent.example.food',
  'settings.agent.example.compare',
  'settings.agent.example.recurring',
  'settings.agent.example.delete',
] as const;

type ShownToken = { id: string; token: string };

export default function PersonalAgentSettings() {
  const t = useT();
  const formatter = useAppFormat();
  const { data: tokens, isLoading, error } = useApiTokensQuery();
  const createMutation = useCreateApiTokenMutation();
  const revokeMutation = useRevokeApiTokenMutation();
  const [name, setName] = useState(DEFAULT_AGENT_NAME);
  const [shownToken, setShownToken] = useState<ShownToken | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<ApiTokenSummary | null>(
    null,
  );
  const mcpUrl = `${useSiteOrigin()}${MCP_PATH}`;

  const agentTokens = (tokens ?? []).filter(isAgentOnlyToken);
  const now = new Date();
  const revokeLabels = {
    title: (tokenName: string) =>
      t('settings.agent.revokeTitle', { name: tokenName }),
    consequence: t('settings.agent.revokeConsequence'),
    cancel: t('common.back'),
    confirm: t('settings.agent.remove'),
  };

  const handleCreate = () => {
    createMutation.mutate(
      { name: name.trim(), scopes: ['AGENT'] },
      {
        onSuccess: (created) =>
          setShownToken({ id: created.id, token: created.token }),
      },
    );
  };

  // A revoked token must not stay on screen, or in the briefing, as if usable.
  const handleConfirmRevoke = (token: ApiTokenSummary) => {
    revokeMutation.mutate(token.id, {
      onSuccess: () =>
        setShownToken((shown) => (shown?.id === token.id ? null : shown)),
    });
    setPendingRevoke(null);
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t('settings.agent.intro')}
      </Typography>

      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          label={t('settings.agent.name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          sx={{ flexGrow: 1 }}
        />
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!name.trim() || createMutation.isPending}
        >
          {createMutation.isPending ? (
            <CircularProgress size={20} />
          ) : (
            t('settings.agent.create')
          )}
        </Button>
      </Stack>

      {createMutation.error && (
        <Alert severity="error">
          {describeApiError(
            createMutation.error,
            t('settings.agent.createFailed'),
          )}
        </Alert>
      )}

      {shownToken && (
        <Alert severity="warning" onClose={() => setShownToken(null)}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {t('settings.agent.copyTokenNow')}
          </Typography>
          <CopyableText
            label={t('settings.agent.token')}
            value={shownToken.token}
          />
        </Alert>
      )}

      <CopyableText label={t('settings.agent.mcpUrl')} value={mcpUrl} />

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          {t('settings.agent.briefingTitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p">
          {t('settings.agent.briefingHint')}
        </Typography>
        <CopyableText
          label={t('settings.agent.briefing')}
          value={buildAgentBriefing({
            mcpUrl,
            token: shownToken?.token ?? null,
          })}
          multiline
        />
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          {t('settings.agent.examplesTitle')}
        </Typography>
        <List dense disablePadding>
          {EXAMPLE_REQUEST_KEYS.map((key) => (
            <ListItem key={key} disableGutters>
              <ListItemText
                primary={t('settings.agent.exampleQuote', { request: t(key) })}
              />
            </ListItem>
          ))}
        </List>
      </Box>

      {revokeMutation.error && (
        <Alert severity="error">
          {describeApiError(
            revokeMutation.error,
            t('settings.agent.revokeFailed'),
          )}
        </Alert>
      )}
      {isLoading && <CircularProgress size={24} />}
      {error && (
        <Alert severity="error">
          {describeApiError(error, t('settings.agent.loadFailed'))}
        </Alert>
      )}
      {agentTokens.length > 0 && (
        <Box>
          <Typography variant="subtitle2">
            {t('settings.agent.activeTitle')}
          </Typography>
          <List dense disablePadding>
            {agentTokens.map((token) => (
              <ListItem
                key={token.id}
                disableGutters
                secondaryAction={
                  <Tooltip title={t('settings.agent.remove')}>
                    <IconButton
                      edge="end"
                      size="small"
                      aria-label={t('settings.agent.removeFor', {
                        name: token.name,
                      })}
                      onClick={() => setPendingRevoke(token)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemText
                  primary={token.name}
                  secondary={describeTokenUse({ token, now, t, formatter })}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      <RevokeTokenDialog
        token={pendingRevoke}
        labels={revokeLabels}
        onCancel={() => setPendingRevoke(null)}
        onConfirm={handleConfirmRevoke}
      />
    </Stack>
  );
}

// A token that also carries another scope belongs to a script; revoking it
// here would break that script too.
function isAgentOnlyToken(token: ApiTokenSummary): boolean {
  return token.scopes.length === 1 && token.scopes[0] === 'AGENT';
}

function describeTokenUse({
  token,
  now,
  t,
  formatter,
}: {
  token: ApiTokenSummary;
  now: Date;
  t: T;
  formatter: AppFormatter;
}): string {
  const lastUse = token.lastUsedAt
    ? t('settings.agent.lastUsed', { date: formatter.day(token.lastUsedAt) })
    : t('settings.agent.neverUsed');
  const expiry =
    new Date(token.expiresAt) <= now
      ? t('settings.agent.expired')
      : t('settings.agent.validUntil', {
          date: formatter.day(token.expiresAt),
        });
  return `${lastUse} · ${expiry}`;
}

function subscribeToNothing(): () => void {
  return () => {};
}

// The page renders on the server first, where there is no origin to read.
function useSiteOrigin(): string {
  return useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => '',
  );
}
