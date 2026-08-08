import { TransactionType } from "./index";

export type AgentMessageSender = "USER" | "ASSISTANT" | "TOOL";

export type AgentPendingActionType = "CREATE_TRANSACTION";

export type AgentPendingActionStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export interface CreateTransactionPendingActionPayload {
  description: string;
  value: number;
  date: string;
  type: TransactionType;
  categoryId: string;
}

export interface AgentPendingAction {
  id: string;
  conversationId: string;
  userId: string;
  type: AgentPendingActionType;
  status: AgentPendingActionStatus;
  payload: CreateTransactionPendingActionPayload;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  resultTransactionId: string | null;
}

export interface AgentMessage {
  id: string;
  conversationId: string;
  sender: AgentMessageSender;
  content: string;
  createdAt: string;
}

export interface AgentToolCall {
  id: string;
  conversationId: string;
  name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown> | null;
  status: "SUCCESS" | "FAILED";
  error: string | null;
  createdAt: string;
}

export interface SendAgentMessageRequest {
  conversationId?: string;
  message: string;
}

export interface SendAgentMessageResponse {
  conversationId: string;
  message: AgentMessage;
  toolCalls: AgentToolCall[];
  pendingAction: AgentPendingAction | null;
}

export interface ConfirmAgentPendingActionResponse {
  pendingActionId: string;
  transactionId: string;
}
