'use client';

import { Typography } from '@mui/material';
import { useT } from '@/i18n/useT';

/** "Added by … · Edited by …" for a row, or nothing when neither is known. */
export default function AttributionLine({
  addedBy,
  editedBy,
}: {
  addedBy?: string | null;
  editedBy?: string | null;
}) {
  const t = useT();
  const parts = [
    addedBy ? t('transactions.attribution.addedBy', { name: addedBy }) : null,
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
