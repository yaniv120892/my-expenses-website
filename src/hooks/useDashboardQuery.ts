import { useQuery } from "@tanstack/react-query";
import {
  fetchDashboard,
  fetchDashboardInsights,
} from "../services/dashboardService";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  overview: () => [...dashboardKeys.all, "overview"] as const,
  insights: () => [...dashboardKeys.all, "insights"] as const,
};

export const useDashboardQuery = () => {
  return useQuery({
    queryKey: dashboardKeys.overview(),
    queryFn: fetchDashboard,
    staleTime: 5 * 60 * 1000,
  });
};

export const useDashboardInsightsQuery = (enabled: boolean) => {
  return useQuery({
    queryKey: dashboardKeys.insights(),
    queryFn: fetchDashboardInsights,
    staleTime: 30 * 60 * 1000,
    enabled,
  });
};
