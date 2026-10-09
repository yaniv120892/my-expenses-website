import { createHandler } from '@/server/http/handler';
import { createApiTokenSchema } from '@/shared/schemas/apiTokens';
import { apiTokenService } from '@/server/services/apiTokenService';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ userId }) => apiTokenService.list(userId),
});

export const POST = createHandler({
  auth: 'session',
  bodySchema: createApiTokenSchema,
  status: 201,
  handler: async ({ userId, body }) =>
    apiTokenService.create(userId, body.name, body.scopes),
});
