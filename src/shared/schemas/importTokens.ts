import { z } from 'zod';

export const createImportTokenSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export type CreateImportTokenInput = z.infer<typeof createImportTokenSchema>;
