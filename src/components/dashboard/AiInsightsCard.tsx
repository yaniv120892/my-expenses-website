'use client';

import {
  Box,
  Card,
  CardContent,
  Typography,
  Skeleton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { DashboardInsightsResponse } from '@/types/dashboard';

interface Props {
  insights: DashboardInsightsResponse | null | undefined;
  isLoading: boolean;
}

export function AiInsightsCard({ insights, isLoading }: Props) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AutoAwesomeIcon color="primary" />
          <Typography variant="h4" component="h2">
            AI Insights
          </Typography>
        </Box>

        {isLoading && (
          <Box>
            {[1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                variant="text"
                width="90%"
                height={20}
                sx={{ mb: 1 }}
              />
            ))}
          </Box>
        )}

        {!isLoading && !insights?.unusualSpending && (
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', fontStyle: 'italic' }}
          >
            Insights unavailable
          </Typography>
        )}

        {!isLoading && insights?.unusualSpending && (
          <>
            <List dense disablePadding>
              {insights.unusualSpending.map((insight, idx) => (
                <ListItem key={idx} disableGutters sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <LightbulbIcon
                      sx={{ color: 'warning.main', fontSize: 18 }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={insight}
                    primaryTypographyProps={{
                      variant: 'body2',
                      color: 'text.primary',
                    }}
                  />
                </ListItem>
              ))}
            </List>
            {insights.summary && (
              <Box
                sx={{
                  mt: 2,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'action.selected',
                }}
              >
                <Typography variant="body2" color="text.primary">
                  {insights.summary}
                </Typography>
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
