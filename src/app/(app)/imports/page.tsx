'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PageHeader from '@/components/shell/PageHeader';
import FileUpload from '@/components/FileUpload';
import ImportList from '@/components/ImportList';
import AutoApproveRuleManager from '@/components/AutoApproveRuleManager';

export default function ImportsPage() {
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [expandedImport, setExpandedImport] = useState<string | null>(null);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

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

      <Dialog
        open={isUploadOpen}
        onClose={() => setUploadOpen(false)}
        maxWidth="sm"
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
          Import File
          <IconButton
            onClick={() => setUploadOpen(false)}
            aria-label="Close"
            size="small"
            edge="end"
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <FileUpload onUploadComplete={() => setUploadOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        maxWidth="md"
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
          Auto-Approve Rules
          <IconButton
            onClick={() => setRulesOpen(false)}
            aria-label="Close"
            size="small"
            edge="end"
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <AutoApproveRuleManager />
        </DialogContent>
      </Dialog>
    </>
  );
}
