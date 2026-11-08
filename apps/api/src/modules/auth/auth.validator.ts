import { z } from "zod";

const emailSchema = z.string().trim().email().max(320).transform((value) => value.toLowerCase());

export const registerSchema = z.object({
  email: emailSchema,
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  password: z.string().min(12).max(128),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(32).max(256),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(32).max(256),
});

export const authBodySchema = z.object({
  refreshToken: z.string().min(32).max(256).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
