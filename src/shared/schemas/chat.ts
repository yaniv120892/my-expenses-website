import { z } from 'zod';

export const chatMessageSchema = z.object({
  sender: z.string(),
  text: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1, 'At least one message is required.'),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;
