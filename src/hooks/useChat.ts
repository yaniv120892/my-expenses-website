import { useCallback, useRef, useState } from 'react';
import { handleApiError } from '@/utils/api';
import { streamMessage } from '../services/chatService';

export interface Message {
  sender: 'user' | 'bot';
  text: string;
}

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Derived rather than stored: the streaming bubble is the last message and
  // stays empty until the first delta lands, so a hand-synced flag would drift.
  const last = messages[messages.length - 1];
  const isAwaitingFirstToken =
    isLoading && last?.sender === 'bot' && last.text === '';

  const appendToLastMessage = useCallback(
    (delta: string, opts: { onlyIfEmpty?: boolean } = {}) => {
      setMessages((prev) => {
        const updated = [...prev];
        const target = updated[updated.length - 1];
        if (!target || target.sender !== 'bot') {
          return prev;
        }
        if (opts.onlyIfEmpty && target.text) {
          return prev;
        }

        updated[updated.length - 1] = {
          ...target,
          text: target.text + delta,
        };
        return updated;
      });
    },
    [],
  );

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) {
        return;
      }

      const outgoing: Message[] = [
        ...messages,
        { sender: 'user' as const, text },
      ];

      // The empty bot message is the bubble that the deltas stream into.
      setMessages([...outgoing, { sender: 'bot' as const, text: '' }]);
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamMessage(
          outgoing,
          {
            onDelta: appendToLastMessage,
            // An empty reply would otherwise leave a blank bubble behind; this
            // is a no-op once any text has arrived.
            onDone: () =>
              appendToLastMessage(
                "Sorry, I wasn't able to produce an answer. Please try again.",
                { onlyIfEmpty: true },
              ),
            onError: appendToLastMessage,
          },
          controller.signal,
        );
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') {
          appendToLastMessage(
            `Sorry, I encountered an error: ${handleApiError(error)}`,
          );
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [appendToLastMessage, isLoading, messages],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    handleSendMessage,
    isLoading,
    isAwaitingFirstToken,
    cancel,
  };
};
