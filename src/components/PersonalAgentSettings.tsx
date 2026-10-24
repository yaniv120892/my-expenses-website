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
import { AGENT_EXAMPLE_REQUESTS } from '@/shared/agentTools';
import { buildAgentBriefing } from '@/utils/agentBriefing';
import { describeApiError } from '@/utils/api';
import { formatDay } from '@/utils/dateUtils';
import CopyableText from '@/components/CopyableText';
import RevokeTokenDialog from '@/components/RevokeTokenDialog';

const DEFAULT_AGENT_NAME = 'Instinct';
const MCP_PATH = '/api/mcp';

const COPY_LABELS = {
  idle: 'העתקה',
  copied: 'הועתק',
  failed: 'ההעתקה נכשלה — סמנו את הטקסט והעתיקו ידנית',
};

const REVOKE_LABELS = {
  title: function revokeTitle(tokenName: string) {
    return `לבטל את הגישה של ״${tokenName}״?`;
  },
  consequence: 'הסוכן יפסיק לגשת ל-My Expenses מיד. אי אפשר לבטל את הפעולה.',
  cancel: 'חזרה',
  confirm: 'ביטול הגישה',
};

type ShownToken = { id: string; token: string };

export default function PersonalAgentSettings() {
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
    <Stack spacing={2} dir="rtl">
      <Typography variant="body2" color="text.secondary">
        חברו את הסוכן האישי שלכם ל-My Expenses, כדי שיוכל לרשום הוצאות והכנסות,
        לתקן ולמחוק אותן ולענות על שאלות על ההוצאות — למשל מהודעה קולית בטלגרם.
        הסוכן מקבל גישה משלו, שאפשר לבטל כאן בכל רגע, והיא תקפה לשנה.
      </Typography>

      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          label="שם הסוכן"
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
            'יצירת גישה לסוכן'
          )}
        </Button>
      </Stack>

      {createMutation.error && (
        <Alert severity="error">
          {describeApiError(createMutation.error, 'יצירת הגישה נכשלה')}
        </Alert>
      )}

      {shownToken && (
        <Alert severity="warning" onClose={() => setShownToken(null)}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            העתיקו את הטוקן עכשיו — הוא לא יוצג שוב. הוא כבר משולב בהודעה לסוכן
            שלמטה.
          </Typography>
          <CopyableText
            label="Token"
            value={shownToken.token}
            copyLabels={COPY_LABELS}
          />
        </Alert>
      )}

      <CopyableText label="MCP URL" value={mcpUrl} copyLabels={COPY_LABELS} />

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          ההודעה לסוכן
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p">
          שלחו לסוכן את ההודעה הזו כמו שהיא. היא באנגלית כי סוכנים עוקבים אחרי
          הוראות באנגלית בצורה הכי מדויקת.
        </Typography>
        <CopyableText
          label="Briefing"
          value={buildAgentBriefing({
            mcpUrl,
            token: shownToken?.token ?? null,
          })}
          copyLabels={COPY_LABELS}
          multiline
        />
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          דוגמאות לבקשות
        </Typography>
        <List dense disablePadding>
          {AGENT_EXAMPLE_REQUESTS.map((request) => (
            <ListItem key={request} disableGutters>
              <ListItemText primary={`״${request}״`} />
            </ListItem>
          ))}
        </List>
      </Box>

      {revokeMutation.error && (
        <Alert severity="error">
          {describeApiError(revokeMutation.error, 'ביטול הגישה נכשל')}
        </Alert>
      )}
      {isLoading && <CircularProgress size={24} />}
      {error && (
        <Alert severity="error">
          {describeApiError(error, 'טעינת הגישות נכשלה')}
        </Alert>
      )}
      {agentTokens.length > 0 && (
        <Box>
          <Typography variant="subtitle2">גישות פעילות</Typography>
          <List dense disablePadding>
            {agentTokens.map((token) => (
              <ListItem
                key={token.id}
                disableGutters
                secondaryAction={
                  <Tooltip title="ביטול הגישה">
                    <IconButton
                      edge="end"
                      size="small"
                      aria-label={`ביטול הגישה של ${token.name}`}
                      onClick={() => setPendingRevoke(token)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemText
                  primary={token.name}
                  secondary={describeTokenUse({ token, now })}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      <RevokeTokenDialog
        token={pendingRevoke}
        labels={REVOKE_LABELS}
        onCancel={() => setPendingRevoke(null)}
        onConfirm={handleConfirmRevoke}
        dir="rtl"
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
}: {
  token: ApiTokenSummary;
  now: Date;
}): string {
  const lastUse = token.lastUsedAt
    ? `שימוש אחרון ${formatDay(token.lastUsedAt)}`
    : 'עדיין לא בשימוש';
  const expiry =
    new Date(token.expiresAt) <= now
      ? 'פג תוקף'
      : `בתוקף עד ${formatDay(token.expiresAt)}`;
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
