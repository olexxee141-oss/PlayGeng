import { z } from "zod";

const amountMinor = z.string().regex(/^[1-9]\d{0,17}$/, "Amount must be a positive integer string in minor units.");

export const createCollectionSchema = z.object({
  providerCode: z.string().trim().min(2).max(64).transform((value) => value.toUpperCase()),
  memberId: z.string().min(1).max(128),
  obligationId: z.string().min(1).max(128).optional(),
  amountMinor,
  idempotencyKey: z.string().trim().min(8).max(160),
}).strict();

export const ingestProviderEventSchema = z.object({
  providerCode: z.string().trim().min(2).max(64).transform((value) => value.toUpperCase()),
  externalEventId: z.string().trim().min(1).max(160),
  eventType: z.string().trim().min(1).max(120),
  collectionReference: z.string().trim().min(1).max(160).optional(),
  payload: z.record(z.string(), z.unknown()),
}).strict();

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type IngestProviderEventInput = z.infer<typeof ingestProviderEventSchema>;
