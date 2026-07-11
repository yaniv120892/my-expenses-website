import api from "./api";
import {
  ConfirmAgentPendingActionResponse,
  SendAgentMessageRequest,
  SendAgentMessageResponse,
} from "@/types/agent";

export const sendAgentMessage = async (
  request: SendAgentMessageRequest
): Promise<SendAgentMessageResponse> => {
  const response = await api.post("/api/agent/messages", request);
  return response.data;
};

export const confirmAgentPendingAction = async (
  pendingActionId: string
): Promise<ConfirmAgentPendingActionResponse> => {
  const response = await api.post(
    `/api/agent/pending-actions/${pendingActionId}/confirm`
  );
  return response.data;
};
