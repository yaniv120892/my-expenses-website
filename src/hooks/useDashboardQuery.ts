import { useQuery } from '@tanstack/react-query';
import { useI18n, type Locale } from '@yaniv120892/my-ui';
import { fetchDashboard, fetchDashboardInsights } from '../services/dashboardService';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  overview: () => [...dashboardKeys.all, 'overview'] as const,
  insights: (locale: Locale) => [...dashboardKeys.all, 'insights', locale] as const,
};

export const useDashboardQuery = () => {
  return useQuery({
    queryKey: dashboardKeys.overview(),
    queryFn: fetchDashboard,
    staleTime: 5 * 60 * 1000,
  });
};

// The server writes insights in the request's language, so each locale caches its own.
export const useDashboardInsightsQuery = (enabled: boolean) => {
  const { locale } = useI18n();
  return useQuery({
    queryKey: dashboardKeys.insights(locale),
    queryFn: fetchDashboardInsights,
    staleTime: 30 * 60 * 1000,
    enabled,
  });
};
