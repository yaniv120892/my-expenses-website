import type { Message } from '@/hooks/useChat';
import { fitChatHistory } from '@/utils/chatHistory';
import { redirectToSessionExpired } from '@/utils/hardNavigate';

export type StreamHandlers = {
  onDelta: (delta: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
};

// Bypasses the shared axios client, which buffers the whole response body.
export const streamMessage = async (
  messages: Message[],
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: fitChatHistory(messages) }),
    signal,
  });

  if (response.status === 401) {
    redirectToSessionExpired();
    return;
  }

  if (!response.ok || !response.body) {
    handlers.onError(`Request failed with status ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleFrame = (frame: string) => {
    const line = frame.split('\n').find((part) => part.startsWith('data: '));
    if (!line) {
      return;
    }

    try {
      const event = JSON.parse(line.slice('data: '.length));

      if (event.type === 'delta') {
        handlers.onDelta(event.value);
      } else if (event.type === 'error') {
        handlers.onError(event.message);
      }
    } catch {
      // A frame that does not parse is not worth failing the whole stream over.
    }
  };

  let chunk = await reader.read();
  while (!chunk.done) {
    buffer += decoder.decode(chunk.value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    frames.forEach(handleFrame);
    chunk = await reader.read();
  }

  if (buffer.trim()) {
    handleFrame(buffer);
  }

  handlers.onDone();
};
