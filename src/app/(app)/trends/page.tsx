'use client';

import { useState } from 'react';
import { Button } from '@mui/material';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import { subMonths } from 'date-fns';
import PageHeader from '@/components/shell/PageHeader';
import { TrendFilters } from '@/types/trends';
import { OverallTrendCard } from '@/components/trends/OverallTrendCard';
import { CategoryTrendCard } from '@/components/trends/CategoryTrendCard';
import { TrendCardSkeleton } from '@/components/trends/TrendSkeleton';
import { TrendFiltersDialog } from '@/components/trends/TrendFiltersDialog';
import { TrendFiltersDisplay } from '@/components/trends/TrendFiltersDisplay';
import {
  useSpendingTrendsQuery,
  useCategorySpendingTrendsQuery,
} from '@/hooks/useTrendsQuery';
import { useCategoriesQuery } from '@/hooks/useTransactionsQuery';

export default function TrendsPage() {
  const [filters, setFilters] = useState<TrendFilters>({
    period: 'monthly',
    startDate: subMonths(new Date(), 6),
    endDate: new Date(),
    selectedCategory: 'All Categories',
    transactionType: 'EXPENSE',
  });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const { data: categories = [] } = useCategoriesQuery();
  const { data: overallTrend, isLoading: isOverallLoading } =
    useSpendingTrendsQuery({
      startDate: filters.startDate,
      endDate: filters.endDate,
      period: filters.period,
      categoryId:
        filters.selectedCategory === 'All Categories'
          ? undefined
          : filters.selectedCategory,
      transactionType: filters.transactionType,
    });

  const { data: categoryTrends = [], isLoading: isCategoryLoading } =
    useCategorySpendingTrendsQuery(
      filters.selectedCategory === 'All Categories'
        ? {
            startDate: filters.startDate,
            endDate: filters.endDate,
            period: filters.period,
            transactionType: filters.transactionType,
          }
        : { period: filters.period },
    );

  const isLoading = isOverallLoading || isCategoryLoading;

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

  const handleApplyFilters = (newFilters: TrendFilters) => {
    setFilters(newFilters);
    setIsFiltersOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Trends"
        action={
          <Button
            variant="contained"
            startIcon={<FilterListRoundedIcon />}
            onClick={() => setIsFiltersOpen(true)}
          >
            Filters
          </Button>
        }
      />

      <TrendFiltersDisplay
        {...filters}
        categories={categories}
        onOpenFilters={() => setIsFiltersOpen(true)}
      />

      <TrendFiltersDialog
        open={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
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

          {filters.selectedCategory === 'All Categories' &&
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
    </>
  );
}
