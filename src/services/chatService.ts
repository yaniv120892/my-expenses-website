import { Message } from '@/hooks/useChat';
import { fitChatHistory } from '@/utils/chatHistory';

export interface StreamHandlers {
  onDelta: (delta: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

/**
 * Streams the assistant's reply over SSE. Bypasses the shared axios client
 * because axios buffers the whole response body and cannot surface it
 * incrementally.
 */
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
    window.location.href = '/login?reason=session-expired';
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

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    // Only complete frames (terminated by a blank line) are consumed; the
    // remainder stays buffered until the next read.
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    frames.forEach(handleFrame);
  }

  if (buffer.trim()) {
    handleFrame(buffer);
  }

  handlers.onDone();
};
