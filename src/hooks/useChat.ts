import { useCallback, useRef, useState } from "react";
import { streamMessage } from "../services/chatService";

export interface Message {
  sender: "user" | "bot";
  text: string;
}

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // True until the first delta lands, so the UI can show a spinner rather than
  // an empty bubble while the agent is still calling tools.
  const [isAwaitingFirstToken, setIsAwaitingFirstToken] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const appendToLastMessage = useCallback((delta: string) => {
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (!last || last.sender !== "bot") return prev;

      updated[updated.length - 1] = { ...last, text: last.text + delta };
      return updated;
    });
  }, []);

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) {
        return;
      }

      const outgoing: Message[] = [
        ...messages,
        { sender: "user" as const, text },
      ];

      // The empty bot message is the bubble that the deltas stream into.
      setMessages([...outgoing, { sender: "bot" as const, text: "" }]);
      setIsLoading(true);
      setIsAwaitingFirstToken(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let received = false;

      try {
        await streamMessage(
          outgoing,
          {
            onDelta: (delta) => {
              if (!received) {
                received = true;
                setIsAwaitingFirstToken(false);
              }
              appendToLastMessage(delta);
            },
            onDone: () => {
              // An empty reply would otherwise leave a blank bubble behind.
              if (!received) {
                appendToLastMessage(
                  "Sorry, I wasn't able to produce an answer. Please try again."
                );
              }
            },
            onError: (message) => {
              received = true;
              setIsAwaitingFirstToken(false);
              appendToLastMessage(message);
            },
          },
          controller.signal
        );
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          appendToLastMessage(
            `Sorry, I encountered an error: ${(error as Error).message}`
          );
        }
      } finally {
        setIsLoading(false);
        setIsAwaitingFirstToken(false);
        abortRef.current = null;
      }
    },
    [appendToLastMessage, isLoading, messages]
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
