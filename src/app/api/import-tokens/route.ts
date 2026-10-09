import { createHandler } from '@/server/http/handler';
import { createImportTokenSchema } from '@/shared/schemas/importTokens';
import { importTokenService } from '@/server/services/importTokenService';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ userId }) => importTokenService.list(userId),
});

export const POST = createHandler({
  auth: 'session',
  bodySchema: createImportTokenSchema,
  status: 201,
  handler: async ({ userId, body }) =>
    importTokenService.create(userId, body.name),
});
