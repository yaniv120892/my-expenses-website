import api from "./api";
import {
  SubscriptionSummary,
  DetectedSubscription,
} from "../types/subscription";

async function fetchSubscriptions(
  status?: string
): Promise<SubscriptionSummary> {
  const params = status ? { status } : {};
  const res = await api.get("/api/subscriptions", { params });
  return res.data;
}

async function confirmSubscription(id: string): Promise<DetectedSubscription> {
  const res = await api.patch(`/api/subscriptions/${id}/confirm`);
  return res.data;
}

async function dismissSubscription(id: string): Promise<DetectedSubscription> {
  const res = await api.patch(`/api/subscriptions/${id}/dismiss`);
  return res.data;
}

async function convertToScheduled(
  id: string,
  categoryId: string
): Promise<DetectedSubscription> {
  const res = await api.post(`/api/subscriptions/${id}/convert`, {
    categoryId,
  });
  return res.data;
}

export {
  fetchSubscriptions,
  confirmSubscription,
  dismissSubscription,
  convertToScheduled,
};
