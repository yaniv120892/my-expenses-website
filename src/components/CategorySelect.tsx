import React from "react";
import { TextField, MenuItem } from "@mui/material";
import { useCategoriesQuery } from "../hooks/useTransactionsQuery";

type CategorySelectProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
    <TextField
      select
      label="Category"
      name="categoryId"
      value={value}
      onChange={onChange}
      error={error}
      helperText={helperText}
      required={required}
      fullWidth={fullWidth}
      disabled={disabled}
    >
      <MenuItem value="">
        <em>Choose category</em>
      </MenuItem>
      {sortedCategories.map((cat) => (
        <MenuItem key={cat.id} value={cat.id}>
          {cat.name}
        </MenuItem>
      ))}
    </TextField>
  );
}
