import type { ChatMessage } from '@/shared/schemas/chat';

// Mirrors the request schema caps in src/shared/schemas/chat.ts. The client
// resends its whole in-memory history each turn, so an overlong bot reply or
// a long session must be trimmed here or every later send 400s forever.
export const MAX_CHAT_MESSAGE_LENGTH = 4000;
export const MAX_CHAT_MESSAGES = 100;

export function fitChatHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(-MAX_CHAT_MESSAGES).map((message) => ({
    ...message,
    text: message.text.slice(0, MAX_CHAT_MESSAGE_LENGTH),
  }));
}
