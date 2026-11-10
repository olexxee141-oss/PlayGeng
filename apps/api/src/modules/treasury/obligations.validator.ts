import { z } from "zod";

const amountMinor = z.string().regex(/^[1-9]\\d{0,17}$/, "Amount must be a positive integer string in minor units.");

export const createObligationSchema = z.object({
  memberId: z.string().min(1).max(128),
  sourceType: z.enum(["CONTRIBUTION", "MATCH_FEE", "COMPETITION_FEE", "OTHER"]),
  sourceId: z.string().trim().min(1).max(128),
  idempotencyKey: z.string().trim().min(8).max(160),
  description: z.string().trim().min(3).max(500),
  amountMinor,
  dueAt: z.string().datetime().optional(),
}).strict();

export const cancelObligationSchema = z.object({
  reason: z.string().trim().min(5).max(300),
  idempotencyKey: z.string().trim().min(8).max(160),
}).strict();

export type CreateObligationInput = z.infer<typeof createObligationSchema>;
export type CancelObligationInput = z.infer<typeof cancelObligationSchema>;
