import { Box, CircularProgress } from "@mui/material";

export default function Loading() {
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="60vh"
    >
      <CircularProgress sx={{ color: "#7b61ff" }} />
    </Box>
  );
}
