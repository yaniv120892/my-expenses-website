'use client';

import { Typography } from '@mui/material';
import type { T } from '@/i18n/useT.types';
import { useT } from '@/i18n/useT';

export default function AttributionLine({
  addedBy,
  editedBy,
  addedAutomatically,
}: {
  addedBy?: string | null;
  editedBy?: string | null;
  addedAutomatically?: boolean;
}) {
  const t = useT();
  const parts = [
    addedLabel({ t, addedBy, addedAutomatically }),
    editedBy ? t('transactions.attribution.editedBy', { name: editedBy }) : null,
  ].filter((part) => part !== null);

  if (parts.length === 0) {
    return null;
  }
  return (
    <Typography
      variant="caption"
      component="span"
      noWrap
      data-testid="transaction-attribution"
      sx={{ display: 'block', color: 'text.secondary' }}
    >
      {parts.join(' · ')}
    </Typography>
  );
}

function addedLabel({
  t,
  addedBy,
  addedAutomatically,
}: {
  t: T;
  addedBy?: string | null;
  addedAutomatically?: boolean;
}): string | null {
  if (addedAutomatically) {
    return t('transactions.attribution.addedAutomatically');
  }
  return addedBy ? t('transactions.attribution.addedBy', { name: addedBy }) : null;
}
