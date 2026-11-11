import { prisma } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import * as treasuryDb from "../treasury/treasury.db.js";
import * as db from "./financial-service.db.js";
import type { CreateCollectionInput, IngestProviderEventInput } from "./financial-service.validator.js";

const requireActiveMember = async (communityId: string, userId: string) => {
  const access = await treasuryDb.findCommunityAccess(communityId, userId);
  if (!access || access.user.status !== "ACTIVE" || access.community.status !== "ACTIVE") {
    throw new AppError("Community not found.", 404);
  }
  return access;
};

const presentCollection = (collection: any) => ({
  ...collection,
  amountMinor: collection.amountMinor.toString(),
});

export const createCollection = async (communityId: string, actorId: string, input: CreateCollectionInput) => {
  await requireActiveMember(communityId, actorId);
  const treasury = await db.findTreasury(communityId);
  if (!treasury) throw new AppError("Community treasury has not been initialized.", 409);

  if (input.memberId !== actorId) {
    const access = await requireActiveMember(communityId, actorId);
    if (access.role !== "TREASURER" && access.role !== "ADMIN") {
      throw new AppError("You can only create a collection for yourself.", 403);
    }
  }

  const provider = await db.findProviderByCode(input.providerCode);
  if (!provider) throw new AppError("Requested financial provider is not configured.", 409);

  const existing = await db.findCollectionByIdempotency(treasury.id, input.idempotencyKey);
  if (existing) {
    if (
      existing.providerId !== provider.id ||
      existing.memberId !== input.memberId ||
      existing.obligationId !== (input.obligationId ?? null) ||
      existing.amountMinor !== BigInt(input.amountMinor)
    ) throw new AppError("Collection idempotency key has already been used with different details.", 409);
    return presentCollection(existing);
  }

  if (input.obligationId) {
    const obligation = await prisma.obligation.findFirst({
      where: { id: input.obligationId, treasuryId: treasury.id, memberId: input.memberId, status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] } },
      include: { allocations: { select: { amountMinor: true } } },
    });
    if (!obligation) throw new AppError("Obligation is not payable in this community.", 409);
    const allocated = obligation.allocations.reduce((sum, item) => sum + item.amountMinor, 0n);
    if (BigInt(input.amountMinor) > obligation.amountMinor - allocated) {
      throw new AppError("Collection amount exceeds the obligation outstanding amount.", 409);
    }
  }

  try {
    const collection = await db.createCollection({
      providerId: provider.id, treasuryId: treasury.id, memberId: input.memberId,
      ...(input.obligationId ? { obligationId: input.obligationId } : {}),
      amountMinor: BigInt(input.amountMinor), currency: treasury.currency,
      idempotencyKey: input.idempotencyKey, createdById: actorId,
    });
    await prisma.financialAuditEvent.create({
      data: {
        treasuryId: treasury.id, actorId, action: "FINANCIAL_COLLECTION_CREATED",
        entityType: "FINANCIAL_COLLECTION", entityId: collection.id,
        metadata: { providerCode: provider.code, amountMinor: input.amountMinor, obligationId: input.obligationId ?? null },
      },
    });
    return presentCollection(collection);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const raced = await db.findCollectionByIdempotency(treasury.id, input.idempotencyKey);
      if (raced) return presentCollection(raced);
    }
    throw error;
  }
};

export const ingestProviderEvent = async (input: IngestProviderEventInput) => {
  const provider = await db.findProviderByCode(input.providerCode);
  if (!provider) throw new AppError("Requested financial provider is not configured.", 404);

  const collection = input.collectionReference
    ? await db.findCollectionByProviderReference(provider.id, input.collectionReference)
    : null;

  const result = await db.createOrFindProviderEvent({
    providerId: provider.id,
    ...(collection ? { collectionId: collection.id } : {}),
    externalEventId: input.externalEventId,
    eventType: input.eventType,
    payload: input.payload,
  });

  return {
    duplicate: result.kind === "EXISTS",
    event: {
      ...result.event,
      collectionId: result.event.collectionId ?? null,
    },
  };
};

export const listMyCollections = async (communityId: string, userId: string) => {
  await requireActiveMember(communityId, userId);
  const treasury = await db.findTreasury(communityId);
  if (!treasury) throw new AppError("Community treasury has not been initialized.", 404);
  return (await db.listCollections(treasury.id, userId)).map(presentCollection);
};
