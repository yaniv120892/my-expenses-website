import { z } from 'zod';

// username falls back to the email — the web client has no separate
// username field, but the API contract still accepts one.
export const signupSchema = z
  .object({
    email: z.string().email(),
    username: z.string().min(1).optional(),
    password: z.string().min(8),
  })
  .transform((value) => ({ ...value, username: value.username ?? value.email }));
export type SignupRequest = z.infer<typeof signupSchema>;

export const loginSchema = z
  .object({
    email: z.string().email(),
    username: z.string().min(1).optional(),
    password: z.string().min(8),
  })
  .transform((value) => ({ ...value, username: value.username ?? value.email }));
export type LoginRequest = z.infer<typeof loginSchema>;

export const verifyLoginCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});
export type VerifyLoginCodeRequest = z.infer<typeof verifyLoginCodeSchema>;
