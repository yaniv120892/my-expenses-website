import api from "./api";
import {
  DashboardResponse,
  DashboardInsightsResponse,
} from "@/types/dashboard";

export async function fetchDashboard(): Promise<DashboardResponse> {
  const res = await api.get("/api/dashboard");
  return res.data;
}

export async function fetchDashboardInsights(): Promise<DashboardInsightsResponse | null> {
  const res = await api.get("/api/dashboard/insights");
  return res.data;
}
