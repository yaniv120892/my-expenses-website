'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
  useCreateImportTokenMutation,
  useImportTokensQuery,
  useRevokeImportTokenMutation,
} from '@/hooks/useImportTokensQuery';
import type { ImportTokenSummary } from '@/types/importToken';
import { describeApiError } from '@/utils/api';
import { formatDay } from '@/utils/dateUtils';

const COPY_LABELS = {
  idle: 'Copy',
  copied: 'Copied',
  failed: 'Copy failed — select the text instead',
} as const;

export default function ImportTokenManager() {
  const { data: tokens, isLoading, error } = useImportTokensQuery();
  const createMutation = useCreateImportTokenMutation();
  const revokeMutation = useRevokeImportTokenMutation();
  const [name, setName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );
  const [pendingRevoke, setPendingRevoke] = useState<ImportTokenSummary | null>(
    null,
  );

  const handleCreate = () => {
    createMutation.mutate(name.trim(), {
      onSuccess: (created) => {
        setCreatedToken(created.token);
        setCopyState('idle');
        setName('');
      },
    });
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
        A token lets <code>npm run statements:import</code> drive the import
        routes without a browser session. It works on imports only, lasts a
        year, and can be revoked here at any time.
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
          disabled={!name.trim() || createMutation.isPending}
        >
          {createMutation.isPending ? <CircularProgress size={20} /> : 'Create'}
        </Button>
      </Stack>

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
          {describeApiError(mutationError, 'Import token request failed')}
        </Alert>
      )}

      {isLoading && <CircularProgress size={24} />}
      {error && (
        <Alert severity="error">
          {describeApiError(error, 'Failed to load import tokens')}
        </Alert>
      )}
      {tokens && tokens.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
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
