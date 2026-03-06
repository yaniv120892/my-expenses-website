"use client";

import React from "react";
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
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import { DashboardInsightsResponse } from "@/types/dashboard";
import { COLORS } from "@/utils/constants";

interface Props {
  insights: DashboardInsightsResponse | null | undefined;
  isLoading: boolean;
}

export function AiInsightsCard({ insights, isLoading }: Props) {
  return (
    <Card
      sx={{
        borderRadius: 3,
        bgcolor: "var(--background)",
        boxShadow: 3,
        height: "100%",
      }}
    >
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <AutoAwesomeIcon sx={{ color: COLORS.purple }} />
          <Typography variant="h6" fontWeight={700} color={COLORS.text}>
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
                sx={{ bgcolor: "var(--secondary)", mb: 1 }}
              />
            ))}
          </Box>
        )}

        {!isLoading && !insights && (
          <Typography
            variant="body2"
            sx={{ color: "var(--text-secondary)", fontStyle: "italic" }}
          >
            Insights unavailable
          </Typography>
        )}

        {!isLoading && insights && (
          <>
            <List dense disablePadding>
              {insights.unusualSpending.map((insight, idx) => (
                <ListItem key={idx} disableGutters sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <LightbulbIcon sx={{ color: "#f39c12", fontSize: 18 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={insight}
                    primaryTypographyProps={{
                      variant: "body2",
                      color: COLORS.text,
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
                  bgcolor: "var(--secondary-light)",
                }}
              >
                <Typography variant="body2" color={COLORS.text}>
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
