import { z } from 'zod';

export const chatMessageSchema = z.object({
  sender: z.string(),
  text: z.string(),
});

export const chatRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1, 'At least one message is required.'),
});
