import { NextResponse } from 'next/server';
import { createHandler } from '@/server/http/handler';
import { signupSchema } from '@/shared/schemas/auth';
import authService from '@/server/services/authService';

export const POST = createHandler({
  auth: 'public',
  bodySchema: signupSchema,
  handler: async ({ body }) => {
    const result = await authService.signupUser(
      body.email,
      body.username,
      body.password,
    );
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }
    return { success: true };
  },
});
