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
    onSearch({
      searchTerm: searchTerm.trim() === "" ? undefined : searchTerm,
      categoryId: categoryId === "" ? undefined : categoryId,
      startDate: startDate === "" ? undefined : startDate,
      endDate: endDate === "" ? undefined : endDate,
    });
  };

  return (
    <Box
      component="form"
      className="card-accent-light"
      display="flex"
      gap={2}
      alignItems="center"
      p={2}
      boxShadow={2}
      onSubmit={handleSubmit}
      style={{ borderRadius: 18 }}
    >
      <TextField
        label="Search"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        size="small"
        style={{ minWidth: 200 }}
        InputProps={{ style: { borderRadius: 16, background: "#f3f6fa" } }}
      />
      <TextField
        select
        label="Category"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        size="small"
        style={{ minWidth: 120 }}
        InputProps={{ style: { borderRadius: 16, background: "#f3f6fa" } }}
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
        slotProps={{ inputLabel: { shrink: true } }}
        InputProps={{ style: { borderRadius: 16, background: "#f3f6fa" } }}
      />
      <TextField
        label="End Date"
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        size="small"
        slotProps={{ inputLabel: { shrink: true } }}
        InputProps={{ style: { borderRadius: 16, background: "#f3f6fa" } }}
      />
      <Button
        type="submit"
        className="button-primary"
        variant="contained"
        style={{ borderRadius: 12, minWidth: 120 }}
      >
        Search
      </Button>
    </Box>
  );
}
