import { createHandler } from '@/server/http/handler';
import userRepository from '@/server/repositories/userRepository';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ userId }) => {
    const user = await userRepository.findById(userId);
    return {
      userId,
      email: user?.email ?? null,
    };
  },
});
