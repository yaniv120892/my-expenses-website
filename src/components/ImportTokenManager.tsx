'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
import { format, parseISO } from 'date-fns';
import { DAY_FORMAT } from '@/shared/dates';
import {
  useCreateImportTokenMutation,
  useImportTokensQuery,
  useRevokeImportTokenMutation,
} from '@/hooks/useImportTokensQuery';
import { describeApiError } from '@/utils/api';

function formatDay(isoDate: string | null): string {
  return isoDate ? format(parseISO(isoDate), DAY_FORMAT) : 'Never';
}

export default function ImportTokenManager() {
  const { data: tokens, isLoading, error } = useImportTokensQuery();
  const createMutation = useCreateImportTokenMutation();
  const revokeMutation = useRevokeImportTokenMutation();
  const [name, setName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    const created = await createMutation.mutateAsync(name.trim());
    setCreatedToken(created.token);
    setCopied(false);
    setName('');
  };

  const handleCopy = async () => {
    if (!createdToken) {
      return;
    }
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
  };

  const mutationError = createMutation.error ?? revokeMutation.error;

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
            <Tooltip title={copied ? 'Copied' : 'Copy'}>
              <IconButton
                size="small"
                onClick={handleCopy}
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
            {tokens.map((token) => (
              <TableRow key={token.id}>
                <TableCell>{token.name}</TableCell>
                <TableCell>{formatDay(token.createdAt)}</TableCell>
                <TableCell>{formatDay(token.lastUsedAt)}</TableCell>
                <TableCell>{formatDay(token.expiresAt)}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Revoke">
                    <IconButton
                      size="small"
                      aria-label={`Revoke ${token.name}`}
                      onClick={() => revokeMutation.mutate(token.id)}
                      disabled={revokeMutation.isPending}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}
