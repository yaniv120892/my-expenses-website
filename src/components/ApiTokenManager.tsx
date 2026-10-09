'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  useApiTokensQuery,
  useCreateApiTokenMutation,
  useRevokeApiTokenMutation,
} from '@/hooks/useApiTokensQuery';
import { API_TOKEN_SCOPES } from '@/shared/types/apiToken';
import type { ApiTokenScope, ApiTokenSummary } from '@/types/apiToken';
import { describeApiError } from '@/utils/api';
import { formatDay } from '@/utils/dateUtils';

const COPY_LABELS = {
  idle: 'Copy',
  copied: 'Copied',
  failed: 'Copy failed — select the text instead',
} as const;

const SCOPE_DETAILS = {
  IMPORTS: {
    label: 'Imports',
    description: 'Upload statements, preview and approve imports',
  },
} satisfies Record<ApiTokenScope, { label: string; description: string }>;

export default function ApiTokenManager() {
  const { data: tokens, isLoading, error } = useApiTokensQuery();
  const createMutation = useCreateApiTokenMutation();
  const revokeMutation = useRevokeApiTokenMutation();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiTokenScope[]>([]);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<keyof typeof COPY_LABELS>('idle');
  const [pendingRevoke, setPendingRevoke] = useState<ApiTokenSummary | null>(
    null,
  );

  const toggleScope = (scope: ApiTokenScope) => {
    setScopes((current) =>
      current.includes(scope)
        ? current.filter((existing) => existing !== scope)
        : [...current, scope],
    );
  };

  const handleCreate = () => {
    createMutation.mutate(
      { name: name.trim(), scopes },
      {
        onSuccess: (created) => {
          setCreatedToken(created.token);
          setCopyState('idle');
          setName('');
          setScopes([]);
        },
      },
    );
  };

  const handleCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const handleConfirmRevoke = () => {
    if (pendingRevoke) {
      revokeMutation.mutate(pendingRevoke.id);
    }
    setPendingRevoke(null);
  };

  const mutationError = createMutation.error ?? revokeMutation.error;
  const now = new Date();

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        A token lets a script such as <code>npm run statements:import</code>{' '}
        call the API without a browser session. It can do only what its scopes
        allow, lasts a year, and can be revoked here at any time.
      </Typography>

      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          label="Token name"
          placeholder="e.g. MacBook statements script"
          value={name}
          onChange={(event) => setName(event.target.value)}
          sx={{ flexGrow: 1 }}
        />
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={
            !name.trim() || scopes.length === 0 || createMutation.isPending
          }
        >
          {createMutation.isPending ? <CircularProgress size={20} /> : 'Create'}
        </Button>
      </Stack>
      <FormGroup>
        {API_TOKEN_SCOPES.map((scope) => (
          <FormControlLabel
            key={scope}
            control={
              <Checkbox
                size="small"
                checked={scopes.includes(scope)}
                onChange={() => toggleScope(scope)}
              />
            }
            label={`${SCOPE_DETAILS[scope].label} — ${SCOPE_DETAILS[scope].description}`}
          />
        ))}
      </FormGroup>

      {createdToken && (
        <Alert severity="warning" onClose={() => setCreatedToken(null)}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Copy this token now — it will not be shown again.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
            >
              {createdToken}
            </Typography>
            <Tooltip title={COPY_LABELS[copyState]}>
              <IconButton
                size="small"
                onClick={() => handleCopy(createdToken)}
                aria-label="Copy token"
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Alert>
      )}

      {mutationError && (
        <Alert severity="error">
          {describeApiError(mutationError, 'API token request failed')}
        </Alert>
      )}

      {isLoading && <CircularProgress size={24} />}
      {error && (
        <Alert severity="error">
          {describeApiError(error, 'Failed to load API tokens')}
        </Alert>
      )}
      {tokens && tokens.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Scopes</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Last used</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {tokens.map((token) => {
              const isExpired = new Date(token.expiresAt) <= now;
              const isRevoking =
                revokeMutation.isPending &&
                revokeMutation.variables === token.id;
              return (
                <TableRow key={token.id}>
                  <TableCell>{token.name}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      {token.scopes.map((scope) => (
                        <Chip
                          key={scope}
                          size="small"
                          label={SCOPE_DETAILS[scope].label}
                        />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>{formatDay(token.createdAt)}</TableCell>
                  <TableCell>
                    {token.lastUsedAt ? formatDay(token.lastUsedAt) : 'Never'}
                  </TableCell>
                  <TableCell>
                    {isExpired ? (
                      <Chip size="small" color="error" label="Expired" />
                    ) : (
                      formatDay(token.expiresAt)
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Revoke">
                      <IconButton
                        size="small"
                        aria-label={`Revoke ${token.name}`}
                        onClick={() => setPendingRevoke(token)}
                        disabled={isRevoking}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!pendingRevoke} onClose={() => setPendingRevoke(null)}>
        <DialogTitle>Revoke “{pendingRevoke?.name}”?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Any script using this token stops working immediately. This cannot
            be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRevoke(null)}>Cancel</Button>
          <Button color="error" onClick={handleConfirmRevoke}>
            Revoke
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
