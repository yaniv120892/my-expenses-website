import { z } from 'zod';

// username falls back to the email — the web client has no separate
// username field, but the API contract still accepts one.
const credentialsSchema = z
  .object({
    email: z.string().email(),
    username: z.string().min(1).optional(),
    password: z.string().min(8),
  })
  .transform((value) => ({
    ...value,
    username: value.username ?? value.email,
  }));

export const signupSchema = credentialsSchema;
export const loginSchema = credentialsSchema;

export const verifyLoginCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});
