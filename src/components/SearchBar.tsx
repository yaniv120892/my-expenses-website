"use client";

import React, { useEffect, useState } from "react";
import { Box, Button, MenuItem, TextField } from "@mui/material";
import { Category } from "../types";
import { getCategories } from "../services/transactions";

type Props = {
  onSearch: (params: {
    searchTerm?: string;
    categoryId?: string;
    startDate?: string;
    endDate?: string;
  }) => void;
};

export default function SearchBar({ onSearch }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ searchTerm, categoryId, startDate, endDate });
  };

  return (
    <Box
      component="form"
      display="flex"
      gap={2}
      alignItems="center"
      mb={2}
      onSubmit={handleSubmit}
    >
      <TextField
        label="Search"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        size="small"
      />
      <TextField
        select
        label="Category"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        size="small"
        style={{ minWidth: 120 }}
      >
        <MenuItem value="">All</MenuItem>
        {categories.map((cat) => (
          <MenuItem key={cat.id} value={cat.id}>
            {cat.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Start Date"
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        size="small"
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        label="End Date"
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        size="small"
        InputLabelProps={{ shrink: true }}
      />
      <Button type="submit" variant="contained">
        Search
      </Button>
    </Box>
  );
}
