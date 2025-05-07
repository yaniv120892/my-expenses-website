"use client";

import React from "react";
import { Paper, Typography, List, ListItem, ListItemText } from "@mui/material";

type Props = {
  data: { [key: string]: number };
  label: string;
};

export default function SummaryChart({ data, label }: Props) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {label}
      </Typography>
      <List>
        {Object.entries(data).map(([key, value]) => (
          <ListItem key={key} disablePadding>
            <ListItemText primary={`${key}: $${value.toLocaleString()}`} />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
