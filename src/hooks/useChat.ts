import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  confirmAgentPendingAction,
  sendAgentMessage,
} from "@/services/agentService";
import { AgentPendingAction } from "@/types/agent";
import { transactionKeys } from "@/hooks/useTransactionsQuery";
import { trendKeys } from "@/hooks/useTrendsQuery";
import { dashboardKeys } from "@/hooks/useDashboardQuery";

export interface Message {
  sender: "user" | "bot";
  text: string;
  pendingAction?: AgentPendingAction;
}

export const useChat = () => {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);

  const sendMutation = useMutation({
    mutationFn: sendAgentMessage,
    onSuccess: (data) => {
      setConversationId(data.conversationId);
      const assistantMessage: Message = {
        text: data.message.content,
        sender: "bot",
        ...(data.pendingAction ? { pendingAction: data.pendingAction } : {}),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error: Error) => {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: `Sorry, I encountered an error: ${error.message}`,
        },
      ]);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: confirmAgentPendingAction,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: transactionKeys.allTransactions(),
      });
      queryClient.invalidateQueries({ queryKey: transactionKeys.summary() });
      queryClient.invalidateQueries({ queryKey: trendKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      setMessages((prev) =>
        prev.map((message) =>
          message.pendingAction?.id === data.pendingActionId
            ? {
                ...message,
                pendingAction: {
                  ...message.pendingAction,
                  status: "CONFIRMED",
                  resultTransactionId: data.transactionId,
                },
              }
            : message
        )
      );
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Done. I created the transaction.",
        },
      ]);
    },
    onError: (error: Error) => {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: `I could not confirm that action: ${error.message}`,
        },
      ]);
    },
  });

  const handleSendMessage = (text: string) => {
    if (!text.trim()) {
      return;
    }

    setMessages((prev) => [...prev, { sender: "user", text }]);
    sendMutation.mutate({ conversationId, message: text.trim() });
  };

  const handleConfirmPendingAction = (pendingActionId: string) => {
    confirmMutation.mutate(pendingActionId);
  };

  return {
    messages,
    handleSendMessage,
    handleConfirmPendingAction,
    isLoading: sendMutation.isPending,
    isConfirming: confirmMutation.isPending,
  };
};
