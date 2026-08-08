import { forceLogout, getStoredToken } from "@/services/authService";

import { Message } from "../hooks/useChat";

export interface StreamHandlers {
  onDelta: (delta: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

/**
 * Streams the assistant's reply over SSE.
 *
 * This deliberately bypasses the shared axios client: axios buffers the whole
 * response body in the browser and cannot surface it incrementally. The auth
 * header and 401 handling below mirror the axios interceptors in api.ts.
 */
export const streamMessage = async (
  messages: Message[],
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> => {
  const token = getStoredToken();

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messages }),
      signal,
    }
  );

  if (response.status === 401) {
    forceLogout();
    return;
  }

  if (!response.ok || !response.body) {
    handlers.onError(`Request failed with status ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleFrame = (frame: string) => {
    const line = frame.split("\n").find((part) => part.startsWith("data: "));
    if (!line) return;

    try {
      const event = JSON.parse(line.slice("data: ".length));

      if (event.type === "delta") {
        handlers.onDelta(event.value);
      } else if (event.type === "error") {
        handlers.onError(event.message);
      }
    } catch {
      // A frame that does not parse is not worth failing the whole stream over.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // A single read can contain several frames, or split one across chunk
    // boundaries — so only complete frames (terminated by a blank line) are
    // consumed, and the remainder stays buffered for the next read.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    frames.forEach(handleFrame);
  }

  if (buffer.trim()) {
    handleFrame(buffer);
  }

  handlers.onDone();
};
