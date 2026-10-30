'use client';

import Link from 'next/link';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { PageHeader } from '@yaniv120892/my-ui';
import EmptyState from '@/components/EmptyState';
import { useHouseholdActivityQuery } from '@/hooks/useHouseholdQuery';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import type { HouseholdActivityView } from '@/shared/types/householdActivity';

/** Who did what in the household, newest first, a page at a time. */
export default function HouseholdActivityPage() {
  const t = useT();
  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useHouseholdActivityQuery();
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader
        title={t('household.activity.title')}
        subtitle={t('household.activity.subtitle')}
        actions={
          <Button component={Link} href="/settings" variant="outlined">
            {t('household.activity.backToSettings')}
          </Button>
        }
      />
      {isLoading ? (
        <CircularProgress size={24} />
      ) : error ? (
        <Alert severity="error">{t('household.activity.loadFailed')}</Alert>
      ) : items.length === 0 ? (
        <EmptyState message={t('household.activity.empty')} />
      ) : (
        <Stack spacing={2}>
          <Paper variant="outlined">
            <List disablePadding>
              {items.map((item) => (
                <ActivityItem key={item.id} item={item} />
              ))}
            </List>
          </Paper>
          {hasNextPage && (
            <Button
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              sx={{ alignSelf: 'center' }}
            >
              {t('household.activity.loadMore')}
            </Button>
          )}
        </Stack>
      )}
    </>
  );
}

function ActivityItem({ item }: { item: HouseholdActivityView }) {
  const t = useT();
  const formatter = useAppFormat();
  const actor =
    item.actorName ??
    (item.systemJob ? t('household.activity.system') : t('household.activity.formerMember'));

  return (
    <ListItem divider data-testid="household-activity-item">
      <ListItemText
        primary={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography component="span" sx={{ fontWeight: 600 }}>
              {actor}
            </Typography>
            <Typography component="span">
              {t(`household.activity.action.${item.action}`)}{' '}
              {t(`household.activity.entity.${item.entityType}`)}
            </Typography>
            {item.viaApiToken && (
              <Chip size="small" variant="outlined" label={t('household.activity.viaToken')} />
            )}
          </Stack>
        }
        secondary={`${item.summary} · ${formatter.date({
          value: new Date(item.createdAt),
          options: { dateStyle: 'medium', timeStyle: 'short' },
        })}`}
      />
    </ListItem>
  );
}
