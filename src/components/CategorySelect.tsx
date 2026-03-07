import React from "react";
import { Autocomplete, TextField } from "@mui/material";
import { useCategoriesQuery } from "../hooks/useTransactionsQuery";

type CategorySelectProps = {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  helperText?: string;
  label?: string;
  required?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
};

export default function CategorySelect({
  value,
  onChange,
  error,
  helperText,
  required = false,
  fullWidth = true,
  disabled = false,
}: CategorySelectProps) {
  const { data: categories = [] } = useCategoriesQuery();
  const sortedCategories = [...categories].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <Autocomplete
      options={sortedCategories}
      getOptionLabel={(option) => option.name}
      value={sortedCategories.find((c) => c.id === value) || null}
      onChange={(_, newValue) => onChange(newValue?.id || "")}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Category"
          error={error}
          helperText={helperText}
          required={required}
        />
      )}
      fullWidth={fullWidth}
      disabled={disabled}
      clearOnEscape
      autoHighlight
    />
  );
}
