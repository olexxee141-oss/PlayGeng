import { prisma } from "@playgeng/database";
import { withTreasuryTransaction } from "../treasury/treasury.db.js";

export const findProviderByCode = (code: string) =>
  prisma.financialProvider.findFirst({ where: { code, status: "ACTIVE" } });

export const findTreasury = (communityId: string) =>
  prisma.treasury.findUnique({ where: { communityId } });

export const findCollectionByIdempotency = (treasuryId: string, idempotencyKey: string) =>
  prisma.financialCollection.findUnique({ where: { treasuryId_idempotencyKey: { treasuryId, idempotencyKey } } });

export const createCollection = (input: {
  providerId: string; treasuryId: string; memberId: string; obligationId?: string;
  amountMinor: bigint; currency: string; idempotencyKey: string; createdById: string;
}) => prisma.financialCollection.create({
  data: {
    providerId: input.providerId, treasuryId: input.treasuryId, memberId: input.memberId,
    ...(input.obligationId ? { obligationId: input.obligationId } : {}),
    amountMinor: input.amountMinor, currency: input.currency, idempotencyKey: input.idempotencyKey,
    createdById: input.createdById, status: "CREATED",
  },
});

export const createOrFindProviderEvent = (input: {
  providerId: string; collectionId?: string; externalEventId: string; eventType: string; payload: unknown;
}) => withTreasuryTransaction(async (tx) => {
  const existing = await tx.providerEvent.findUnique({
    where: { providerId_externalEventId: { providerId: input.providerId, externalEventId: input.externalEventId } },
  });
  if (existing) return { kind: "EXISTS" as const, event: existing };

  const event = await tx.providerEvent.create({
    data: {
      providerId: input.providerId, ...(input.collectionId ? { collectionId: input.collectionId } : {}),
      externalEventId: input.externalEventId, eventType: input.eventType, payload: input.payload as any,
      status: "RECEIVED",
    },
  });
  return { kind: "CREATED" as const, event };
});

export const findCollectionByProviderReference = (providerId: string, reference: string) =>
  prisma.financialCollection.findFirst({
    where: {
      providerId,
      OR: [{ externalReference: reference }, { providerCollectionId: reference }],
    },
  });

export const listCollections = (treasuryId: string, memberId?: string) =>
  prisma.financialCollection.findMany({
    where: { treasuryId, ...(memberId ? { memberId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
