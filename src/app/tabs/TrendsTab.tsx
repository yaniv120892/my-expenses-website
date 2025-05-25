"use client";

import { useState, useEffect } from "react";
import { Box } from "@mui/material";
import {
  SpendingTrend,
  CategorySpendingTrend,
  TrendFilters,
} from "@/types/trends";
import {
  fetchSpendingTrends,
  fetchCategorySpendingTrends,
} from "@/services/trendService";
import { subMonths } from "date-fns";
import { getCategories } from "@/services/transactions";
import { Category } from "@/types";
import { OverallTrendCard } from "@/components/trends/OverallTrendCard";
import { CategoryTrendCard } from "@/components/trends/CategoryTrendCard";
import { TrendCardSkeleton } from "@/components/trends/TrendSkeleton";
import { TrendFiltersDialog } from "@/components/trends/TrendFiltersDialog";
import { TrendFiltersDisplay } from "@/components/trends/TrendFiltersDisplay";

export default function TrendsTab() {
  const [filters, setFilters] = useState<TrendFilters>({
    period: "monthly",
    startDate: subMonths(new Date(), 6),
    endDate: new Date(),
    selectedCategory: "All Categories",
    transactionType: "EXPENSE",
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [overallTrend, setOverallTrend] = useState<SpendingTrend | null>(null);
  const [categoryTrends, setCategoryTrends] = useState<CategorySpendingTrend[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (error) {
        console.error("Error loading categories:", error);
      }
    };
    loadCategories();
  }, []);

  const fetchTrends = async () => {
    setIsLoading(true);
    try {
      const overallTrend = await fetchSpendingTrends({
        startDate: filters.startDate,
        endDate: filters.endDate,
        period: filters.period,
        categoryId:
          filters.selectedCategory === "All Categories"
            ? undefined
            : filters.selectedCategory,
        transactionType: filters.transactionType,
      });
      setOverallTrend(overallTrend);
      if (filters.selectedCategory === "All Categories") {
        const categories = await fetchCategorySpendingTrends({
          startDate: filters.startDate,
          endDate: filters.endDate,
          period: filters.period,
          transactionType: filters.transactionType,
        });
        setCategoryTrends(categories);
      }
    } catch (error) {
      console.error("Error fetching trends:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [filters]);

  const handleCategoryExpand = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleOpenFilters = () => {
    setIsFiltersOpen(true);
  };

  const handleCloseFilters = () => {
    setIsFiltersOpen(false);
  };

  const handleApplyFilters = (newFilters: TrendFilters) => {
    setFilters(newFilters);
    setIsFiltersOpen(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <TrendFiltersDisplay
        {...filters}
        categories={categories}
        onOpenFilters={handleOpenFilters}
      />

      <TrendFiltersDialog
        open={isFiltersOpen}
        onClose={handleCloseFilters}
        onApply={handleApplyFilters}
        {...filters}
        categories={categories}
      />

      {isLoading ? (
        <TrendCardSkeleton />
      ) : (
        <>
          {overallTrend && (
            <OverallTrendCard
              trend={overallTrend}
              selectedCategory={filters.selectedCategory}
              categories={categories}
              transactionType={filters.transactionType}
              period={filters.period}
            />
          )}

          {filters.selectedCategory === "All Categories" &&
            categoryTrends.map((trend) => (
              <CategoryTrendCard
                key={trend.categoryId}
                trend={trend}
                transactionType={filters.transactionType}
                period={filters.period}
                isExpanded={expandedCategories.has(trend.categoryId)}
                onExpand={handleCategoryExpand}
              />
            ))}
        </>
      )}
    </Box>
  );
}
