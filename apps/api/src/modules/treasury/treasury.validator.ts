import { z } from "zod";

const amountMinor = z.string().regex(/^[1-9]\d{0,17}$/, "Amount must be a positive integer string in minor units.");

export const initializeTreasurySchema = z.object({
  currency: z.string().length(3).regex(/^[A-Z]{3}$/),
}).strict();

export const postJournalSchema = z.object({
  type: z.enum(["OPENING_BALANCE", "OBLIGATION_ISSUED", "PAYMENT_RECEIVED", "CONTRIBUTION_RECEIVED", "EXPENSE_PAID", "REFUND", "ADJUSTMENT", "REVERSAL"]),
  description: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().trim().min(8).max(160),
  sourceType: z.string().trim().min(1).max(64).optional(),
  sourceId: z.string().trim().min(1).max(128).optional(),
  postings: z.array(z.object({
    accountCode: z.string().trim().min(1).max(32),
    side: z.enum(["DEBIT", "CREDIT"]),
    amountMinor,
  }).strict()).min(2).max(20),
}).strict();

export const reverseJournalSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  reason: z.string().trim().min(5).max(500),
}).strict();

export type InitializeTreasuryInput = z.infer<typeof initializeTreasurySchema>;
export type PostJournalInput = z.infer<typeof postJournalSchema>;
export type ReverseJournalInput = z.infer<typeof reverseJournalSchema>;
