import React from "react";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, Typography, Fade } from "@mui/material";

type Props = {
  message: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({ message, icon, actionLabel, onAction }: Props) {
  return (
    <Fade in>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight={180}
        gap={1.5}
        sx={{
          textAlign: "center",
        }}
      >
        {icon || <InfoOutlinedIcon sx={{ fontSize: 48, color: "text.secondary" }} />}
        <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
          {message}
        </Typography>
        {actionLabel && onAction && (
          <Typography
            component="button"
            onClick={onAction}
            sx={{
              color: "primary.main",
              cursor: "pointer",
              fontWeight: 600,
              background: "none",
              border: "none",
              fontSize: "inherit",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {actionLabel}
          </Typography>
        )}
      </Box>
    </Fade>
  );
}
