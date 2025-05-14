import { useMediaQuery } from "@mui/material";

export function useIsMobile() {
  return useMediaQuery("(max-width:600px)");
}
