'use client';

import { useState } from 'react';
import { Box, Button, Tab, Tabs } from '@mui/material';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import { subMonths } from 'date-fns';
import PageHeader from '@/components/shell/PageHeader';
import { ComparisonMeasure, TrendFilters, TrendsView } from '@/types/trends';
import { OverallTrendCard } from '@/components/trends/OverallTrendCard';
import { CategoryTrendCard } from '@/components/trends/CategoryTrendCard';
import { CategoryComparisonSection } from '@/components/trends/CategoryComparisonSection';
import { TrendCardSkeleton } from '@/components/trends/TrendSkeleton';
import { TrendFiltersDialog } from '@/components/trends/TrendFiltersDialog';
import { TrendFiltersDisplay } from '@/components/trends/TrendFiltersDisplay';
import {
  useSpendingTrendsQuery,
  useCategorySpendingTrendsQuery,
  useCategoryComparisonQuery,
} from '@/hooks/useTrendsQuery';
import { useCategoriesQuery } from '@/hooks/useTransactionsQuery';

export default function TrendsPage() {
  const [view, setView] = useState<TrendsView>('overview');
  const [filters, setFilters] = useState<TrendFilters>({
    period: 'monthly',
    startDate: subMonths(new Date(), 6),
    endDate: new Date(),
    selectedCategory: 'All Categories',
    transactionType: 'EXPENSE',
    comparisonCategoryIds: [],
    comparisonScope: 'SUBTREE',
  });
  const [measure, setMeasure] = useState<ComparisonMeasure>('net');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const isCompare = view === 'compare';
  const isAllCategories = filters.selectedCategory === 'All Categories';

  const { data: categories = [] } = useCategoriesQuery();
  const { data: overallTrend, isLoading: isOverallLoading } =
    useSpendingTrendsQuery(
      {
        startDate: filters.startDate,
        endDate: filters.endDate,
        period: filters.period,
        categoryId: isAllCategories ? undefined : filters.selectedCategory,
        transactionType: filters.transactionType,
      },
      !isCompare,
    );

  const { data: categoryTrends = [], isLoading: isCategoryLoading } =
    useCategorySpendingTrendsQuery(
      {
        startDate: filters.startDate,
        endDate: filters.endDate,
        period: filters.period,
        transactionType: filters.transactionType,
      },
      !isCompare && isAllCategories,
    );

  const { data: comparison, isLoading: isComparisonLoading } =
    useCategoryComparisonQuery(
      {
        startDate: filters.startDate,
        endDate: filters.endDate,
        period: filters.period,
        categoryIds: filters.comparisonCategoryIds,
        scope: filters.comparisonScope,
      },
      isCompare,
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

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={view}
          onChange={(_, value) => setView(value as TrendsView)}
          aria-label="Trends view"
        >
          <Tab label="Overview" value="overview" />
          <Tab label="Compare" value="compare" />
        </Tabs>
      </Box>

      <TrendFiltersDisplay
        {...filters}
        view={view}
        categories={categories}
        onOpenFilters={() => setIsFiltersOpen(true)}
      />

      <TrendFiltersDialog
        open={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        onApply={handleApplyFilters}
        {...filters}
        categories={categories}
        showComparisonFields={isCompare}
      />

      {isCompare ? (
        <CategoryComparisonSection
          comparison={comparison}
          isLoading={isComparisonLoading}
          selectedCount={filters.comparisonCategoryIds.length}
          measure={measure}
          onMeasureChange={setMeasure}
          onOpenFilters={() => setIsFiltersOpen(true)}
        />
      ) : isLoading ? (
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

          {isAllCategories &&
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
