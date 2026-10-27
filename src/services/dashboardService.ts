import api from './api';
import type { DashboardResponse, DashboardInsightsResponse } from '@/types/dashboard';

export async function fetchDashboard(): Promise<DashboardResponse> {
  const response = await api.get('/api/dashboard');
  return response.data;
}

export async function fetchDashboardInsights(): Promise<DashboardInsightsResponse | null> {
  const response = await api.get('/api/dashboard/insights');
  return response.data;
}
