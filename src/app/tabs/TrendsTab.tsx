"use client";

import { useState, useEffect } from "react";
import { Box, Typography, SelectChangeEvent } from "@mui/material";
import {
  TrendPeriod,
  SpendingTrend,
  CategorySpendingTrend,
  TransactionType,
} from "@/types/trends";
import {
  fetchSpendingTrends,
  fetchCategorySpendingTrends,
} from "@/services/trendService";
import { subMonths } from "date-fns";
import { getCategories } from "@/services/transactions";
import { Category } from "@/types";
import { TrendFilters } from "@/components/trends/TrendFilters";
import { OverallTrendCard } from "@/components/trends/OverallTrendCard";
import { CategoryTrendCard } from "@/components/trends/CategoryTrendCard";
import { TrendCardSkeleton } from "@/components/trends/TrendSkeleton";

export default function TrendsTab() {
  const [period, setPeriod] = useState<TrendPeriod>("monthly");
  const [startDate, setStartDate] = useState<Date>(subMonths(new Date(), 6));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedCategory, setSelectedCategory] =
    useState<string>("All Categories");
  const [transactionType, setTransactionType] =
    useState<TransactionType>("EXPENSE");
  const [categories, setCategories] = useState<Category[]>([]);
  const [overallTrend, setOverallTrend] = useState<SpendingTrend | null>(null);
  const [categoryTrends, setCategoryTrends] = useState<CategorySpendingTrend[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

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
        startDate,
        endDate,
        period,
        categoryId:
          selectedCategory === "All Categories" ? undefined : selectedCategory,
        transactionType,
      });
      setOverallTrend(overallTrend);
      if (selectedCategory === "All Categories") {
        const categories = await fetchCategorySpendingTrends({
          startDate,
          endDate,
          period,
          transactionType,
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
  }, [period, startDate, endDate, selectedCategory, transactionType]);

  const handlePeriodChange = (event: SelectChangeEvent<TrendPeriod>) => {
    setPeriod(event.target.value as TrendPeriod);
  };

  const handleCategoryChange = (event: SelectChangeEvent<string>) => {
    setSelectedCategory(event.target.value);
  };

  const handleStartDateChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setStartDate(new Date(event.target.value));
  };

  const handleEndDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(new Date(event.target.value));
  };

  const handleTransactionTypeChange = (
    event: SelectChangeEvent<TransactionType>
  ) => {
    setTransactionType(event.target.value as TransactionType);
  };

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

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom color="var(--text-color)">
        {transactionType === "EXPENSE" ? "Spending" : "Income"} Trends
      </Typography>

      <TrendFilters
        period={period}
        startDate={startDate}
        endDate={endDate}
        selectedCategory={selectedCategory}
        transactionType={transactionType}
        categories={categories}
        onPeriodChange={handlePeriodChange}
        onStartDateChange={handleStartDateChange}
        onEndDateChange={handleEndDateChange}
        onCategoryChange={handleCategoryChange}
        onTransactionTypeChange={handleTransactionTypeChange}
      />

      {isLoading ? (
        <TrendCardSkeleton />
      ) : (
        <>
          {overallTrend && (
            <OverallTrendCard
              trend={overallTrend}
              selectedCategory={selectedCategory}
              categories={categories}
              transactionType={transactionType}
              period={period}
            />
          )}

          {selectedCategory === "All Categories" &&
            categoryTrends.map((trend) => (
              <CategoryTrendCard
                key={trend.categoryId}
                trend={trend}
                transactionType={transactionType}
                period={period}
                isExpanded={expandedCategories.has(trend.categoryId)}
                onExpand={handleCategoryExpand}
              />
            ))}
        </>
      )}
    </Box>
  );
}
