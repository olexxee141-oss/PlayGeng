import { z } from "zod";

const amountMinor = z.string().regex(/^[1-9]\\d{0,17}$/, "Amount must be a positive integer string in minor units.");

export const createManualReceiptSchema = z.object({
  memberId: z.string().min(1).max(128),
  externalReference: z.string().trim().min(3).max(160),
  evidenceReference: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().trim().min(8).max(100),
  amountMinor,
  receivedAt: z.string().datetime(),
  allocations: z.array(z.object({
    obligationId: z.string().min(1).max(128),
    amountMinor,
  }).strict()).min(1).max(25),
}).strict();

export type CreateManualReceiptInput = z.infer<typeof createManualReceiptSchema>;
