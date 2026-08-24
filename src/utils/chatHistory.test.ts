import { describe, expect, it } from 'vitest';
import {
  fitChatHistory,
  MAX_CHAT_MESSAGES,
  MAX_CHAT_MESSAGE_LENGTH,
} from '@/utils/chatHistory';

describe('fitChatHistory', () => {
  it('keeps a short history untouched', () => {
    const messages = [
      { sender: 'user' as const, text: 'hi' },
      { sender: 'bot' as const, text: 'hello' },
    ];

    expect(fitChatHistory(messages)).toEqual(messages);
  });

  it('truncates an overlong bot reply so later sends still validate', () => {
    const long = 'a'.repeat(MAX_CHAT_MESSAGE_LENGTH + 500);

    const [fitted] = fitChatHistory([{ sender: 'bot', text: long }]);

    expect(fitted.text).toHaveLength(MAX_CHAT_MESSAGE_LENGTH);
  });

  it('keeps only the newest messages once the cap is reached', () => {
    const messages = Array.from({ length: MAX_CHAT_MESSAGES + 10 }, (_, i) => ({
      sender: 'user' as const,
      text: `message ${i}`,
    }));

    const fitted = fitChatHistory(messages);

    expect(fitted).toHaveLength(MAX_CHAT_MESSAGES);
    expect(fitted[0].text).toBe('message 10');
    expect(fitted[fitted.length - 1].text).toBe(
      `message ${MAX_CHAT_MESSAGES + 9}`,
    );
  });
});
