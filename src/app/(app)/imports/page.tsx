'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogProps,
  DialogTitle,
  IconButton,
  Stack,
} from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PageHeader from '@/components/shell/PageHeader';
import FileUpload from '@/components/FileUpload';
import ImportList from '@/components/ImportList';
import AutoApproveRuleManager from '@/components/AutoApproveRuleManager';
import { useIsCompact } from '@/hooks/useBreakpoints';

function ClosableDialog({
  open,
  onClose,
  title,
  maxWidth,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidth: DialogProps['maxWidth'];
  children: React.ReactNode;
}) {
  const fullScreen = useIsCompact();

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
          aria-label="Close"
          size="small"
          edge="end"
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>{children}</DialogContent>
    </Dialog>
  );
}

export default function ImportsPage() {
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [expandedImport, setExpandedImport] = useState<string | null>(null);

  const handleImportClick = (importId: string) => {
    setExpandedImport((prev) => (prev === importId ? null : importId));
  };

  return (
    <>
      <PageHeader
        title="Imports"
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<AutoFixHighOutlinedIcon />}
              onClick={() => setRulesOpen(true)}
            >
              Rules
            </Button>
            <Button
              variant="contained"
              startIcon={<UploadFileOutlinedIcon />}
              onClick={() => setUploadOpen(true)}
            >
              Upload
            </Button>
          </Stack>
        }
      />

      <ImportList
        onImportClick={handleImportClick}
        expandedImportId={expandedImport}
      />

      <ClosableDialog
        open={isUploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Import File"
        maxWidth="sm"
      >
        <FileUpload onUploadComplete={() => setUploadOpen(false)} />
      </ClosableDialog>

      <ClosableDialog
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        title="Auto-Approve Rules"
        maxWidth="md"
      >
        <AutoApproveRuleManager />
      </ClosableDialog>
    </>
  );
}
