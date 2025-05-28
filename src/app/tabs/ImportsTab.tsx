import React, { useState } from "react";
import { Box, Typography, Fab, Modal, Snackbar, Alert } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useIsMobile } from "../../hooks/useIsMobile";
import FileUpload from "../../components/FileUpload";
import ImportList from "../../components/ImportList";

function AddImportFab({
  onClick,
  visible,
}: {
  onClick: () => void;
  visible: boolean;
}) {
  if (visible) {
    return (
      <Box
        sx={{
          position: "fixed",
          bottom: 32,
          right: 32,
          display: "flex",
          flexDirection: "row",
          gap: 2,
          zIndex: 2000,
        }}
      >
        <Fab color="secondary" aria-label="add" onClick={onClick}>
          <AddIcon />
        </Fab>
      </Box>
    );
  }
  return null;
}

export default function ImportsTab() {
  const isMobile = useIsMobile();
  const [isModalOpen, setModalOpen] = useState(false);
  const [expandedImport, setExpandedImport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUploadComplete = () => {
    setModalOpen(false);
  };

  const handleImportClick = (importId: string) => {
    if (expandedImport === importId) {
      setExpandedImport(null);
    } else {
      setExpandedImport(importId);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Typography variant="h4" color="var(--text-color)">
          Imports
        </Typography>
      </Box>

      <Box sx={{ mt: 2, flex: 1 }}>
        <ImportList
          onImportClick={handleImportClick}
          expandedImportId={expandedImport}
        />
      </Box>

      <AddImportFab onClick={() => setModalOpen(true)} visible={!isModalOpen} />

      <Modal
        open={isModalOpen}
        onClose={() => setModalOpen(false)}
        aria-labelledby="import-modal-title"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            borderRadius: 2,
            boxShadow: 24,
            p: 4,
            width: isMobile ? "90%" : 600,
            maxHeight: "90vh",
            overflow: "auto",
            backgroundColor: "white",
          }}
        >
          <Typography
            id="import-modal-title"
            variant="h6"
            component="h2"
            mb={3}
          >
            Import File
          </Typography>
          <FileUpload onUploadComplete={handleUploadComplete} />
        </Box>
      </Modal>

      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={() => setError(null)}
      >
        <Alert severity="error">{error}</Alert>
      </Snackbar>
    </Box>
  );
}
