import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;

const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH);

// username falls back to the email — the web client has no separate
// username field, but the API contract still accepts one.
const withUsernameFallback = <T extends { email: string; username?: string }>(value: T) => ({
  ...value,
  username: value.username ?? value.email,
});

// No password: it is chosen at verification, by whoever holds the mailed code.
// An older client's password field is stripped.
export const signupSchema = z
  .object({
    email: z.email(),
    username: z.string().min(1).optional(),
  })
  .transform(withUsernameFallback);

export const loginSchema = z
  .object({
    email: z.email(),
    username: z.string().min(1).optional(),
    password: passwordSchema,
  })
  .transform(withUsernameFallback);

export const verifyLoginCodeSchema = z.object({
  email: z.email(),
  code: z.string().min(1),
  password: passwordSchema,
});

export const passwordResetRequestSchema = z.object({
  email: z.email(),
});

export const passwordResetSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
