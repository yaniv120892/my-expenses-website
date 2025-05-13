import React from "react";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, Typography } from "@mui/material";

type Props = {
  message: string;
};

export default function EmptyState({ message }: Props) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight={180}
      gap={1.5}
      sx={{ color: "var(--accent-purple)", width: "100%" }}
    >
      <InfoOutlinedIcon sx={{ fontSize: 48, opacity: 0.6 }} />
      <Typography variant="subtitle1" sx={{ opacity: 0.8, fontWeight: 500 }}>
        {message}
      </Typography>
    </Box>
  );
}
