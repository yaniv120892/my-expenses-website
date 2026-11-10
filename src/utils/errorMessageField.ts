import { z } from 'zod';

const messageBodySchema = z.object({ message: z.string() });

export function messageField(body: unknown): string | null {
  return messageBodySchema.safeParse(body).data?.message ?? null;
}
