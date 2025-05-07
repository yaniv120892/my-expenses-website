"use client";

import React from "react";
import { ToggleButton, ToggleButtonGroup, Box } from "@mui/material";

type Props = {
  value: "category" | "month";
  onChange: (value: "category" | "month") => void;
};

export default function SummaryToggle({ value, onChange }: Props) {
  return (
    <Box mb={2}>
      <ToggleButtonGroup
        value={value}
        exclusive
        onChange={(_, val) => val && onChange(val)}
        aria-label="summary toggle"
      >
        <ToggleButton value="category" aria-label="By Category">
          By Category
        </ToggleButton>
        <ToggleButton value="month" aria-label="By Month">
          By Month
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
