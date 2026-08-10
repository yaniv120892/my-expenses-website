import TrendArrowUpward from '@mui/icons-material/TrendingUp';
import TrendArrowDownward from '@mui/icons-material/TrendingDown';
import TrendArrowFlat from '@mui/icons-material/TrendingFlat';

interface TrendIconProps {
  trend: 'up' | 'down' | 'stable';
}

export const TrendIcon = ({ trend }: TrendIconProps) => {
  switch (trend) {
    case 'up':
      return <TrendArrowUpward color="error" fontSize="small" />;
    case 'down':
      return <TrendArrowDownward color="success" fontSize="small" />;
    default:
      return <TrendArrowFlat color="info" fontSize="small" />;
  }
};
