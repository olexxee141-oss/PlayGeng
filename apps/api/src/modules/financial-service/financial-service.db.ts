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


export const settleVerifiedEvent = (input: { providerId: string; externalEventId: string; systemActorId: string }) =>
  withTreasuryTransaction(async (tx) => {
    const event = await tx.providerEvent.findUnique({
      where: { providerId_externalEventId: { providerId: input.providerId, externalEventId: input.externalEventId } },
      include: { collection: { include: { treasury: { include: { accounts: true } } } } },
    });
    if (!event) return { kind: "EVENT_NOT_FOUND" as const };

    // Idempotency takes precedence over lifecycle state because a successful settlement
    // marks the event PROCESSED. Retrying the same verified event must return EXISTS,
    // not EVENT_NOT_VALIDATED.
    const existing = await tx.financialSettlement.findUnique({
      where: { providerEventId: event.id },
      include: { treasuryReceipt: true },
    });
    if (existing) return { kind: "EXISTS" as const, settlement: existing };

    if (!event.collection) return { kind: "UNMATCHED_EVENT" as const, event };
    if (event.status === "REJECTED") return { kind: "EVENT_REJECTED" as const, event };
    if (event.status !== "VALIDATED") return { kind: "EVENT_NOT_VALIDATED" as const, event };

    const collection = event.collection;

    const payload = event.payload as Record<string, unknown>;
    const amountValue = payload.amountMinor;
    const currencyValue = payload.currency;
    const successValue = payload.success;
    const receivedAtValue = payload.receivedAt;

    if (successValue !== true || typeof amountValue !== "string" || !/^[1-9]\d*$/.test(amountValue) || typeof currencyValue !== "string") {
      return { kind: "NOT_SETTLEABLE" as const, event };
    }

    const observedAmount = BigInt(amountValue);
    const observedCurrency = currencyValue.toUpperCase();
    if (observedAmount !== collection.amountMinor || observedCurrency !== collection.currency) {
      const record = await tx.financialReconciliationRecord.create({
        data: {
          collectionId: collection.id,
          status: "DISCREPANCY",
          expectedAmountMinor: collection.amountMinor,
          observedAmountMinor: observedAmount,
          currency: collection.currency,
          reason: observedAmount !== collection.amountMinor ? "Provider amount does not match collection amount." : "Provider currency does not match collection currency.",
          metadata: { providerEventId: event.id, observedCurrency },
        },
      });
      const settlement = await tx.financialSettlement.create({
        data: {
          collectionId: collection.id,
          providerEventId: event.id,
          status: "RECONCILIATION_REQUIRED",
          amountMinor: collection.amountMinor,
          currency: collection.currency,
          idempotencyKey: `settlement:${event.id}`,
          failureReason: record.reason,
        },
      });
      await tx.providerEvent.update({ where: { id: event.id }, data: { status: "PROCESSED", validatedAt: new Date(), processedAt: new Date() } });
      return { kind: "RECONCILIATION_REQUIRED" as const, settlement, record };
    }

    // Lock the obligation before calculating its outstanding balance.
    if (collection.obligationId) {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE "obligations" SET "updatedAt" = "updatedAt"
        WHERE "id" = ${collection.obligationId} AND "treasuryId" = ${collection.treasuryId}
        RETURNING "id"
      `;
      if (locked.length !== 1) return { kind: "OBLIGATION_NOT_FOUND" as const };
    }

    const receiptKey = `provider:${event.id}`;
    const priorReceipt = await tx.paymentReceipt.findUnique({
      where: { treasuryId_idempotencyKey: { treasuryId: collection.treasuryId, idempotencyKey: receiptKey } },
    });
    if (priorReceipt) {
      // The receipt and settlement are committed in one serializable transaction.
      // A receipt without its settlement therefore indicates legacy/manual corruption,
      // not a recoverable partial commit. Never silently bless it as settled.
      return { kind: "RECEIPT_EXISTS_WITHOUT_SETTLEMENT" as const, receiptId: priorReceipt.id };
    }

    const accounts = collection.treasury.accounts.filter((account) => account.isActive);
    const cash = accounts.find((account) => account.code === "CASH");
    const receivables = accounts.find((account) => account.code === "RECEIVABLES");
    if (!cash || !receivables) throw new Error("Required treasury settlement accounts are missing or inactive.");

    if (collection.obligationId) {
      const obligation = await tx.obligation.findFirst({
        where: { id: collection.obligationId, treasuryId: collection.treasuryId, memberId: collection.memberId },
        include: { allocations: { select: { amountMinor: true } } },
      });
      if (!obligation || obligation.status === "CANCELLED") return { kind: "OBLIGATION_NOT_SETTLEABLE" as const };
      const allocated = obligation.allocations.reduce((sum, item) => sum + item.amountMinor, 0n);
      if (allocated + collection.amountMinor > obligation.amountMinor) return { kind: "OBLIGATION_OVERALLOCATED" as const };
    }

    const receipt = await tx.paymentReceipt.create({
      data: {
        treasuryId: collection.treasuryId,
        memberId: collection.memberId,
        source: "PROVIDER_SETTLEMENT",
        amountMinor: collection.amountMinor,
        currency: collection.currency,
        externalReference: `${collection.providerId}:${event.externalEventId}`,
        evidenceReference: event.id,
        idempotencyKey: receiptKey,
        receivedAt: typeof receivedAtValue === "string" && !Number.isNaN(Date.parse(receivedAtValue)) ? new Date(receivedAtValue) : event.receivedAt,
        verifiedById: input.systemActorId,
      },
    });

    const journal = await tx.journalTransaction.create({
      data: {
        treasuryId: collection.treasuryId,
        type: "PAYMENT_RECEIVED",
        status: "DRAFT",
        description: `Provider-settled collection ${event.externalEventId}`,
        sourceType: "FINANCIAL_SETTLEMENT",
        sourceId: event.id,
        idempotencyKey: `receipt:${receiptKey}`,
        createdById: input.systemActorId,
      },
    });
    await tx.ledgerPosting.createMany({ data: [
      { treasuryId: collection.treasuryId, journalTransactionId: journal.id, accountId: cash.id, side: "DEBIT", amountMinor: receipt.amountMinor },
      { treasuryId: collection.treasuryId, journalTransactionId: journal.id, accountId: receivables.id, side: "CREDIT", amountMinor: receipt.amountMinor },
    ] });
    await tx.journalTransaction.update({ where: { id: journal.id }, data: { status: "POSTED", postedAt: new Date() } });

    if (collection.obligationId) {
      await tx.obligationAllocation.create({
        data: {
          treasuryId: collection.treasuryId,
          memberId: collection.memberId,
          receiptId: receipt.id,
          obligationId: collection.obligationId,
          amountMinor: collection.amountMinor,
          idempotencyKey: `settlement:${event.id}:allocation`,
          createdById: input.systemActorId,
        },
      });
    }

    const settlement = await tx.financialSettlement.create({
      data: {
        collectionId: collection.id,
        providerEventId: event.id,
        treasuryReceiptId: receipt.id,
        status: "SETTLED",
        amountMinor: collection.amountMinor,
        currency: collection.currency,
        idempotencyKey: `settlement:${event.id}`,
        settledAt: new Date(),
      },
    });

    await tx.financialCollection.update({ where: { id: collection.id }, data: { status: "SUCCEEDED" } });
    await tx.providerEvent.update({ where: { id: event.id }, data: { status: "PROCESSED", validatedAt: new Date(), processedAt: new Date() } });
    await tx.financialAuditEvent.create({
      data: {
        treasuryId: collection.treasuryId,
        actorId: input.systemActorId,
        action: "PROVIDER_COLLECTION_SETTLED",
        entityType: "FINANCIAL_SETTLEMENT",
        entityId: settlement.id,
        reason: "Verified provider event settled atomically into Treasury.",
        metadata: { collectionId: collection.id, providerEventId: event.id, receiptId: receipt.id, journalTransactionId: journal.id, amountMinor: collection.amountMinor.toString() },
      },
    });
    return { kind: "SETTLED" as const, settlement };
  });
