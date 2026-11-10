import { prisma } from "@playgeng/database";
import { withTreasuryTransaction } from "./treasury.db.js";
import type { CreateManualReceiptInput } from "./receipts.validator.js";

const receiptInclude = {
  allocations: {
    include: { obligation: { select: { id: true, description: true, amountMinor: true, dueAt: true, status: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  member: { select: { id: true, firstName: true, lastName: true, email: true } },
  verifiedBy: { select: { id: true, firstName: true, lastName: true } },
};

export const createManualReceipt = (input: {
  treasuryId: string;
  currency: string;
  actorId: string;
  data: CreateManualReceiptInput;
}) => withTreasuryTransaction(async (tx) => {
  const existing = await tx.paymentReceipt.findUnique({
    where: { treasuryId_idempotencyKey: { treasuryId: input.treasuryId, idempotencyKey: input.data.idempotencyKey } },
    include: { allocations: true },
  });
  if (existing) return { kind: "EXISTS" as const, receipt: existing };

  const allocations = [...input.data.allocations].sort((a, b) => a.obligationId.localeCompare(b.obligationId));
  const obligationIds = allocations.map((allocation) => allocation.obligationId);
  if (new Set(obligationIds).size !== obligationIds.length) return { kind: "DUPLICATE_OBLIGATION" as const };

  // Lock each obligation in a stable order. Cancellation takes the same row lock,
  // preventing a receipt from settling an obligation while it is being cancelled.
  for (const obligationId of obligationIds) {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "obligations"
      WHERE "id" = ${obligationId} AND "treasuryId" = ${input.treasuryId}
      FOR UPDATE
    `;
    if (locked.length !== 1) return { kind: "OBLIGATION_NOT_FOUND" as const };
  }

  const obligations = await tx.obligation.findMany({
    where: { id: { in: obligationIds }, treasuryId: input.treasuryId, memberId: input.data.memberId },
    include: { allocations: { select: { amountMinor: true } } },
  });
  if (obligations.length !== obligationIds.length) return { kind: "OBLIGATION_SCOPE_MISMATCH" as const };

  const requestedTotal = allocations.reduce((sum, allocation) => sum + BigInt(allocation.amountMinor), 0n);
  if (requestedTotal !== BigInt(input.data.amountMinor)) return { kind: "ALLOCATION_TOTAL_MISMATCH" as const };

  for (const allocation of allocations) {
    const obligation = obligations.find((item) => item.id === allocation.obligationId)!;
    if (obligation.status === "CANCELLED") return { kind: "OBLIGATION_CANCELLED" as const };
    const alreadyAllocated = obligation.allocations.reduce((sum, item) => sum + item.amountMinor, 0n);
    if (alreadyAllocated + BigInt(allocation.amountMinor) > obligation.amountMinor) return { kind: "OBLIGATION_OVERALLOCATED" as const };
  }

  const receipt = await tx.paymentReceipt.create({
    data: {
      treasuryId: input.treasuryId,
      memberId: input.data.memberId,
      source: "MANUAL_RECONCILIATION",
      amountMinor: BigInt(input.data.amountMinor),
      currency: input.currency,
      externalReference: input.data.externalReference,
      evidenceReference: input.data.evidenceReference,
      idempotencyKey: input.data.idempotencyKey,
      receivedAt: new Date(input.data.receivedAt),
      verifiedById: input.actorId,
    },
  });

  const journal = await tx.journalTransaction.create({
    data: {
      treasuryId: input.treasuryId,
      type: "PAYMENT_RECEIVED",
      status: "DRAFT",
      description: `Manually verified receipt ${input.data.externalReference}`,
      sourceType: "PAYMENT_RECEIPT",
      sourceId: receipt.id,
      idempotencyKey: `receipt:${input.data.idempotencyKey}`,
      createdById: input.actorId,
    },
  });
  const accounts = await tx.treasuryAccount.findMany({
    where: { treasuryId: input.treasuryId, isActive: true, code: { in: ["CASH", "RECEIVABLES"] } },
  });
  const cash = accounts.find((account) => account.code === "CASH");
  const receivables = accounts.find((account) => account.code === "RECEIVABLES");
  if (!cash || !receivables) throw new Error("Required treasury receipt accounts are missing or inactive.");

  await tx.ledgerPosting.createMany({ data: [
    { treasuryId: input.treasuryId, journalTransactionId: journal.id, accountId: cash.id, side: "DEBIT", amountMinor: receipt.amountMinor },
    { treasuryId: input.treasuryId, journalTransactionId: journal.id, accountId: receivables.id, side: "CREDIT", amountMinor: receipt.amountMinor },
  ] });
  await tx.journalTransaction.update({ where: { id: journal.id }, data: { status: "POSTED", postedAt: new Date() } });

  await tx.obligationAllocation.createMany({
    data: allocations.map((allocation) => ({
      treasuryId: input.treasuryId,
      memberId: input.data.memberId,
      receiptId: receipt.id,
      obligationId: allocation.obligationId,
      amountMinor: BigInt(allocation.amountMinor),
      idempotencyKey: `rcpt:${input.data.idempotencyKey}:${allocation.obligationId}`,
      createdById: input.actorId,
    })),
  });
  await tx.financialAuditEvent.create({
    data: {
      treasuryId: input.treasuryId,
      actorId: input.actorId,
      action: "MANUAL_RECEIPT_VERIFIED",
      entityType: "PAYMENT_RECEIPT",
      entityId: receipt.id,
      reason: "Manual receipt independently reconciled by Treasurer",
      metadata: {
        externalReference: input.data.externalReference,
        evidenceReference: input.data.evidenceReference,
        amountMinor: input.data.amountMinor,
        journalTransactionId: journal.id,
        allocationCount: allocations.length,
      },
    },
  });
  return {
    kind: "CREATED" as const,
    receipt: await tx.paymentReceipt.findUniqueOrThrow({ where: { id: receipt.id }, include: receiptInclude }),
  };
});

export const findReceiptByIdempotency = (treasuryId: string, idempotencyKey: string) =>
  prisma.paymentReceipt.findUnique({
    where: { treasuryId_idempotencyKey: { treasuryId, idempotencyKey } },
    include: receiptInclude,
  });

export const findReceipt = (treasuryId: string, receiptId: string) =>
  prisma.paymentReceipt.findFirst({ where: { id: receiptId, treasuryId }, include: receiptInclude });

export const listReceipts = (treasuryId: string, where: { memberId?: string; cursor?: string; limit: number }) =>
  prisma.paymentReceipt.findMany({
    where: { treasuryId, ...(where.memberId ? { memberId: where.memberId } : {}) },
    include: receiptInclude,
    orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
    ...(where.cursor ? { cursor: { id: where.cursor }, skip: 1 } : {}),
    take: where.limit,
  });
