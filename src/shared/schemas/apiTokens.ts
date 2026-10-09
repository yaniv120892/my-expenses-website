import { z } from 'zod';
import { API_TOKEN_SCOPES } from '@/shared/types/apiToken';

export const createApiTokenSchema = z.object({
  name: z.string().trim().min(1).max(100),
  scopes: z.array(z.enum(API_TOKEN_SCOPES)).min(1),
});
