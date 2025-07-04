import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { sendMessage } from '../services/chatService';

export interface Message {
  sender: 'user' | 'bot';
  text: string;
}

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);

  const mutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: (data) => {
      const assistantMessage: Message = { text: data, sender: 'bot' };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error: Error) => {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: `Sorry, I encountered an error: ${error.message}` },
      ]);
    },
  });

  const handleSendMessage = (text: string) => {
    if (!text.trim()) {
      return;
    }
    setMessages((prev) => {
      const updated = [...prev, { sender: 'user' as const, text }];
      mutation.mutate(updated);
      return updated;
    });
  };

  return {
    messages,
    handleSendMessage,
    isLoading: mutation.isPending,
  };
};
