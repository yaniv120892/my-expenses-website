'use client';

import { useState } from 'react';
import type { DialogProps } from '@mui/material';
import { Button, Dialog, DialogContent, DialogTitle, IconButton, Stack } from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { PageHeader } from '@yaniv120892/my-ui';
import { useCanWrite } from '@/hooks/useSession';
import FileUpload from '@/components/FileUpload';
import ImportList from '@/components/ImportList';
import AutoApproveRuleManager from '@/components/AutoApproveRuleManager';
import { useIsCompact } from '@/hooks/useBreakpoints';
import { useT } from '@/i18n/useT';

function ClosableDialog({
  open,
  onClose,
  title,
  maxWidth,
  busy = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidth: DialogProps['maxWidth'];
  // Unmounting does not cancel in-flight uploads, so closing is blocked while
  // a batch runs rather than leaving the user without any progress to watch.
  busy?: boolean;
  children: React.ReactNode;
}) {
  const t = useT();
  const fullScreen = useIsCompact();

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth={maxWidth}
      fullWidth
      fullScreen={fullScreen}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {title}
        <IconButton
          onClick={onClose}
          aria-label={t('common.close')}
          size="small"
          edge="end"
          disabled={busy}
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>{children}</DialogContent>
    </Dialog>
  );
}

export default function ImportsPage() {
  const t = useT();
  const canWrite = useCanWrite();
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [isUploadRunning, setUploadRunning] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [expandedImport, setExpandedImport] = useState<string | null>(null);

  const handleImportClick = (importId: string) => {
    setExpandedImport((prev) => (prev === importId ? null : importId));
  };

  return (
    <>
      <PageHeader
        title={t('imports.title')}
        actions={
          canWrite && (
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<AutoFixHighOutlinedIcon />}
                onClick={() => setRulesOpen(true)}
              >
                {t('imports.rules')}
              </Button>
              <Button
                variant="contained"
                startIcon={<UploadFileOutlinedIcon />}
                onClick={() => setUploadOpen(true)}
              >
                {t('imports.uploadAction')}
              </Button>
            </Stack>
          )
        }
      />

      <ImportList onImportClick={handleImportClick} expandedImportId={expandedImport} />

      <ClosableDialog
        open={isUploadOpen}
        onClose={() => setUploadOpen(false)}
        title={t('imports.uploadDialogTitle')}
        maxWidth="sm"
        busy={isUploadRunning}
      >
        <FileUpload
          onUploadComplete={() => setUploadOpen(false)}
          onRunningChange={setUploadRunning}
        />
      </ClosableDialog>

      <ClosableDialog
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        title={t('imports.rulesDialogTitle')}
        maxWidth="md"
      >
        <AutoApproveRuleManager />
      </ClosableDialog>
    </>
  );
}
