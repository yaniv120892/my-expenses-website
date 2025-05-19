import React, { useEffect, useState } from "react";
import { TextField, MenuItem } from "@mui/material";
import { Category } from "../types";
import { getCategories } from "../services/transactions";

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
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    async function fetchAndSetCategories() {
      const fetchedCategories = await getCategories();
      const sortedCategories = [...fetchedCategories].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setCategories(sortedCategories);
    }
    fetchAndSetCategories();
  }, []);

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
      {categories.map((cat) => (
        <MenuItem key={cat.id} value={cat.id}>
          {cat.name}
        </MenuItem>
      ))}
    </TextField>
  );
}
