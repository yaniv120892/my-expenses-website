'use client';

import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
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
import { MIRROR_IN_RTL_SX } from '@/components/rtlStyles';
import { useHouseholdActivityQuery } from '@/hooks/useHouseholdQuery';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import type { HouseholdActivityView } from '@/shared/types/householdActivity';
import { describeHouseholdActivity } from '@/utils/householdActivityText';

export default function HouseholdActivityPage() {
  const t = useT();
  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useHouseholdActivityQuery();
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <Button
        component={Link}
        href="/settings"
        color="inherit"
        startIcon={<ArrowBackIcon sx={MIRROR_IN_RTL_SX} />}
        sx={{ mb: 1 }}
      >
        {t('household.activity.backToSettings')}
      </Button>
      <PageHeader
        title={t('household.activity.title')}
        subtitle={t('household.activity.subtitle')}
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
  const { sentence, detail } = describeHouseholdActivity({ item, t });
  const time = formatter.date({
    value: new Date(item.createdAt),
    options: { dateStyle: 'medium', timeStyle: 'short' },
  });

  return (
    <ListItem divider data-testid="household-activity-item">
      <ListItemText
        primary={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography component="span">{sentence}</Typography>
            {item.viaApiToken && (
              <Chip size="small" variant="outlined" label={t('household.activity.viaToken')} />
            )}
          </Stack>
        }
        secondary={detail ? `${detail} · ${time}` : time}
      />
    </ListItem>
  );
}
