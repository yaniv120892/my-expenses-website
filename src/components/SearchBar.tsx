"use client";

import React, { useEffect, useState } from "react";
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
    <form
      className="card-accent-light"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        alignItems: "stretch",
        borderRadius: 24,
        padding: 24,
        boxShadow: "var(--card-shadow)",
        minWidth: 220,
        width: "100%",
      }}
      onSubmit={handleSubmit}
    >
      <input
        className="searchbar-purple"
        style={{ minWidth: 0, marginBottom: 8 }}
        placeholder="Search"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        type="text"
      />
      <select
        className="searchbar-purple"
        style={{ minWidth: 0, marginBottom: 8 }}
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
      >
        <option value="">All</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
      <input
        className="searchbar-purple"
        type="date"
        value={startDate}
        style={{ marginBottom: 8 }}
        onChange={(e) => setStartDate(e.target.value)}
      />
      <input
        className="searchbar-purple"
        type="date"
        value={endDate}
        style={{ marginBottom: 16 }}
        onChange={(e) => setEndDate(e.target.value)}
      />
      <button
        type="submit"
        className="button-primary"
        style={{ borderRadius: 16, minWidth: 0 }}
      >
        Search
      </button>
    </form>
  );
}
