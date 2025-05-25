import TrendArrowUpward from "@mui/icons-material/TrendingUp";
import TrendArrowDownward from "@mui/icons-material/TrendingDown";
import TrendArrowFlat from "@mui/icons-material/TrendingFlat";

interface TrendIconProps {
  trend: "up" | "down" | "stable";
}

export const TrendIcon = ({ trend }: TrendIconProps) => {
  switch (trend) {
    case "up":
      return <TrendArrowUpward color="error" />;
    case "down":
      return <TrendArrowDownward color="success" />;
    default:
      return <TrendArrowFlat color="info" />;
  }
};
