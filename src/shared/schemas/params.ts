import { z } from 'zod';

// Every dynamic segment in the API is a uuid column. Validating params turns
// a malformed id into a schema 400 before Prisma raises P2023 on the query.
export const idParamsSchema = z.object({ id: z.string().uuid() });

export const importIdParamsSchema = z.object({ importId: z.string().uuid() });

export const ruleIdParamsSchema = z.object({ ruleId: z.string().uuid() });

export const importedTransactionIdParamsSchema = z.object({
  importedTransactionId: z.string().uuid(),
});

export const attachmentParamsSchema = z.object({
  id: z.string().uuid(),
  fileId: z.string().uuid(),
});
