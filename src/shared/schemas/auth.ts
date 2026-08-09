import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type SignupRequest = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginRequest = z.infer<typeof loginSchema>;

export const verifyLoginCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});
export type VerifyLoginCodeRequest = z.infer<typeof verifyLoginCodeSchema>;
