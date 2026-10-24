'use client';

import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
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
import CopyableText from '@/components/CopyableText';
import RevokeTokenDialog from '@/components/RevokeTokenDialog';

const COPY_LABELS = {
  idle: 'Copy',
  copied: 'Copied',
  failed: 'Copy failed — select the text instead',
};

const REVOKE_LABELS = {
  title: function revokeTitle(tokenName: string) {
    return `Revoke “${tokenName}”?`;
  },
  consequence:
    'Any script using this token stops working immediately. This cannot be undone.',
  cancel: 'Cancel',
  confirm: 'Revoke',
};

const SCOPE_DETAILS = {
  IMPORTS: {
    label: 'Imports',
    description: 'Upload statements, preview and approve imports',
  },
  AGENT: {
    label: 'Personal agent',
    description: 'Read, add, edit and delete transactions over MCP',
  },
} satisfies Record<ApiTokenScope, { label: string; description: string }>;

export default function ApiTokenManager() {
  const { data: tokens, isLoading, error } = useApiTokensQuery();
  const createMutation = useCreateApiTokenMutation();
  const revokeMutation = useRevokeApiTokenMutation();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiTokenScope[]>([]);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
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
          setName('');
          setScopes([]);
        },
      },
    );
  };

  const handleConfirmRevoke = (token: ApiTokenSummary) => {
    revokeMutation.mutate(token.id);
    setPendingRevoke(null);
  };

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
          <CopyableText
            key={createdToken}
            label="Token"
            value={createdToken}
            copyLabels={COPY_LABELS}
          />
        </Alert>
      )}

      {createMutation.error && (
        <Alert severity="error">
          {describeApiError(createMutation.error, 'Failed to create the token')}
        </Alert>
      )}
      {revokeMutation.error && (
        <Alert severity="error">
          {describeApiError(revokeMutation.error, 'Failed to revoke the token')}
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

      <RevokeTokenDialog
        token={pendingRevoke}
        labels={REVOKE_LABELS}
        onCancel={() => setPendingRevoke(null)}
        onConfirm={handleConfirmRevoke}
      />
    </Stack>
  );
}
