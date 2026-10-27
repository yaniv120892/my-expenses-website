import api from './api';
import type {
  SubscriptionSummary,
  DetectedSubscription,
  UpdateSubscriptionPayload,
} from '../types/subscription';

async function fetchSubscriptions(status?: string): Promise<SubscriptionSummary> {
  const params = status ? { status } : {};
  const response = await api.get('/api/subscriptions', { params });
  return response.data;
}

async function confirmSubscription(id: string): Promise<DetectedSubscription> {
  const response = await api.patch(`/api/subscriptions/${id}/confirm`);
  return response.data;
}

async function dismissSubscription(id: string): Promise<DetectedSubscription> {
  const response = await api.patch(`/api/subscriptions/${id}/dismiss`);
  return response.data;
}

async function updateSubscription(
  id: string,
  payload: UpdateSubscriptionPayload,
): Promise<DetectedSubscription> {
  const response = await api.patch(`/api/subscriptions/${id}`, payload);
  return response.data;
}

async function convertToScheduled(id: string, categoryId?: string): Promise<DetectedSubscription> {
  const response = await api.post(`/api/subscriptions/${id}/convert`, {
    ...(categoryId ? { categoryId } : {}),
  });
  return response.data;
}

export {
  fetchSubscriptions,
  confirmSubscription,
  dismissSubscription,
  updateSubscription,
  convertToScheduled,
};
