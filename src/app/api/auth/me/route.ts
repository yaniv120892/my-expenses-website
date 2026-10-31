import { createHandler } from '@/server/http/handler';
import userRepository from '@/server/repositories/userRepository';
import type { MeResponse } from '@/shared/types/household';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ userId, actor }): Promise<MeResponse> => {
    const user = await userRepository.findById(userId);
    return {
      userId,
      email: user?.email ?? null,
      role: actor.role,
    };
  },
});
