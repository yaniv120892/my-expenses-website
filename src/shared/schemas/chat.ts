import { z } from 'zod';

export const chatMessageSchema = z.object({
  sender: z.enum(['user', 'bot']),
  // Empty text stays legal: the client keeps a failed reply as an empty
  // bot bubble and resends it with the history.
  text: z.string().max(4000, 'Message is too long.'),
});

export const chatRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1, 'At least one message is required.')
    .max(100, 'Conversation is too long.'),
});
