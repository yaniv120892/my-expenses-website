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
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import CopyableText from '@/components/CopyableText';
import RevokeTokenDialog from '@/components/RevokeTokenDialog';

const STATEMENTS_IMPORT_COMMAND = 'npm run statements:import';

export default function ApiTokenManager() {
  const t = useT();
  const formatter = useAppFormat();
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
  const revokeLabels = {
    title: (tokenName: string) =>
      t('settings.tokens.revokeTitle', { name: tokenName }),
    consequence: t('settings.tokens.revokeConsequence'),
    cancel: t('common.cancel'),
    confirm: t('settings.tokens.revoke'),
  };
  const [introBefore, introAfter] = t('settings.tokens.intro').split(
    '{command}',
  );

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {introBefore}
        <code>{STATEMENTS_IMPORT_COMMAND}</code>
        {introAfter}
      </Typography>

      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          label={t('settings.tokens.name')}
          placeholder={t('settings.tokens.namePlaceholder')}
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
          {createMutation.isPending ? (
            <CircularProgress size={20} />
          ) : (
            t('settings.tokens.create')
          )}
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
            label={t('settings.tokens.scopeOption', {
              label: t(`settings.tokens.scope.${scope}`),
              description: t(`settings.tokens.scope.${scope}.description`),
            })}
          />
        ))}
      </FormGroup>

      {createdToken && (
        <Alert severity="warning" onClose={() => setCreatedToken(null)}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {t('settings.tokens.copyNow')}
          </Typography>
          <CopyableText
            key={createdToken}
            label={t('settings.agent.token')}
            value={createdToken}
          />
        </Alert>
      )}

      {createMutation.error && (
        <Alert severity="error">
          {describeApiError(
            createMutation.error,
            t('settings.tokens.createFailed'),
          )}
        </Alert>
      )}
      {revokeMutation.error && (
        <Alert severity="error">
          {describeApiError(
            revokeMutation.error,
            t('settings.tokens.revokeFailed'),
          )}
        </Alert>
      )}

      {isLoading && <CircularProgress size={24} />}
      {error && (
        <Alert severity="error">
          {describeApiError(error, t('settings.tokens.loadFailed'))}
        </Alert>
      )}
      {tokens && tokens.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('settings.tokens.column.name')}</TableCell>
              <TableCell>{t('settings.tokens.column.scopes')}</TableCell>
              <TableCell>{t('settings.tokens.column.created')}</TableCell>
              <TableCell>{t('settings.tokens.column.lastUsed')}</TableCell>
              <TableCell>{t('settings.tokens.column.expires')}</TableCell>
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
                          label={t(`settings.tokens.scope.${scope}`)}
                        />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>{formatter.day(token.createdAt)}</TableCell>
                  <TableCell>
                    {token.lastUsedAt
                      ? formatter.day(token.lastUsedAt)
                      : t('settings.tokens.never')}
                  </TableCell>
                  <TableCell>
                    {isExpired ? (
                      <Chip
                        size="small"
                        color="error"
                        label={t('settings.tokens.expired')}
                      />
                    ) : (
                      formatter.day(token.expiresAt)
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('settings.tokens.revoke')}>
                      <IconButton
                        size="small"
                        aria-label={t('settings.tokens.revokeFor', {
                          name: token.name,
                        })}
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
        labels={revokeLabels}
        onCancel={() => setPendingRevoke(null)}
        onConfirm={handleConfirmRevoke}
      />
    </Stack>
  );
}
