import { prisma } from "@playgeng/database";
import { withTreasuryTransaction } from "./treasury.db.js";
import type { CreateObligationInput } from "./obligations.validator.js";

const incomeAccountBySource = {
  CONTRIBUTION: "CONTRIBUTION_INCOME",
  MATCH_FEE: "MATCH_INCOME",
  COMPETITION_FEE: "REGISTRATION_INCOME",
  OTHER: "CONTRIBUTION_INCOME",
} as const;

export const createObligation = (input: {
  treasuryId: string;
  actorId: string;
  memberId: string;
  data: CreateObligationInput;
}) => withTreasuryTransaction(async (tx) => {
  const existing = await tx.obligation.findFirst({
    where: { treasuryId: input.treasuryId, OR: [
      { idempotencyKey: input.data.idempotencyKey },
      { sourceType: input.data.sourceType, sourceId: input.data.sourceId },
    ] },
    include: { allocations: true },
  });
  if (existing) return { kind: "EXISTS" as const, obligation: existing };

  const accounts = await tx.treasuryAccount.findMany({
    where: { treasuryId: input.treasuryId, code: { in: ["RECEIVABLES", incomeAccountBySource[input.data.sourceType]] }, isActive: true },
  });
  const receivables = accounts.find((account) => account.code === "RECEIVABLES");
  const income = accounts.find((account) => account.code === incomeAccountBySource[input.data.sourceType]);
  if (!receivables || !income) throw new Error("Required treasury accounts are missing or inactive.");

  const obligation = await tx.obligation.create({
    data: {
      treasuryId: input.treasuryId,
      memberId: input.memberId,
      sourceType: input.data.sourceType,
      sourceId: input.data.sourceId,
      idempotencyKey: input.data.idempotencyKey,
      description: input.data.description,
      amountMinor: BigInt(input.data.amountMinor),
      createdById: input.actorId,
      ...(input.data.dueAt ? { dueAt: new Date(input.data.dueAt) } : {}),
    },
  });
  const journal = await tx.journalTransaction.create({
    data: {
      treasuryId: input.treasuryId,
      type: "OBLIGATION_ISSUED",
      status: "DRAFT",
      description: `Obligation issued: ${input.data.description}`,
      sourceType: "OBLIGATION",
      sourceId: obligation.id,
      idempotencyKey: `obl:${input.data.idempotencyKey}`,
      createdById: input.actorId,
    },
  });
  await tx.ledgerPosting.createMany({ data: [
    { treasuryId: input.treasuryId, journalTransactionId: journal.id, accountId: receivables.id, side: "DEBIT", amountMinor: obligation.amountMinor },
    { treasuryId: input.treasuryId, journalTransactionId: journal.id, accountId: income.id, side: "CREDIT", amountMinor: obligation.amountMinor },
  ] });
  await tx.journalTransaction.update({ where: { id: journal.id }, data: { status: "POSTED", postedAt: new Date() } });
  await tx.financialAuditEvent.create({
    data: { treasuryId: input.treasuryId, actorId: input.actorId, action: "OBLIGATION_CREATED", entityType: "OBLIGATION", entityId: obligation.id, metadata: { memberId: input.memberId, sourceType: input.data.sourceType, sourceId: input.data.sourceId, amountMinor: input.data.amountMinor, journalTransactionId: journal.id } },
  });
  return { kind: "CREATED" as const, obligation };
});

export const findObligationByIdempotency = (treasuryId: string, idempotencyKey: string) =>
  prisma.obligation.findUnique({ where: { treasuryId_idempotencyKey: { treasuryId, idempotencyKey } }, include: { allocations: true } });

export const cancelObligation = (input: { treasuryId: string; obligationId: string; actorId: string; reason: string; idempotencyKey: string }) =>
  withTreasuryTransaction(async (tx) => {
    const obligation = await tx.obligation.findFirst({
      where: { id: input.obligationId, treasuryId: input.treasuryId },
      include: { allocations: true },
    });
    if (!obligation) return { kind: "NOT_FOUND" as const };
    if (obligation.status === "CANCELLED") {
      const priorReversal = await tx.journalTransaction.findFirst({
        where: { treasuryId: input.treasuryId, reversalOfId: { not: null }, idempotencyKey: input.idempotencyKey },
      });
      const originalJournal = await tx.journalTransaction.findFirst({
        where: { treasuryId: input.treasuryId, sourceType: "OBLIGATION", sourceId: obligation.id, status: "POSTED" },
        select: { id: true },
      });
      if (priorReversal) {
        if (priorReversal.reversalOfId !== originalJournal?.id || priorReversal.description !== "Obligation cancellation: " + input.reason) return { kind: "IDEMPOTENCY_CONFLICT" as const };
        return { kind: "CANCELLED" as const, obligation };
      }
      return { kind: "ALREADY_CANCELLED" as const };
    }
    if (obligation.allocations.length > 0) return { kind: "SETTLED" as const };

    const original = await tx.journalTransaction.findFirst({
      where: { treasuryId: input.treasuryId, sourceType: "OBLIGATION", sourceId: obligation.id, status: "POSTED" },
      include: { postings: true },
    });
    if (!original) throw new Error("Posted obligation journal was not found.");
    const existingKey = await tx.journalTransaction.findUnique({
      where: { treasuryId_idempotencyKey: { treasuryId: input.treasuryId, idempotencyKey: input.idempotencyKey } },
    });
    if (existingKey) return { kind: "IDEMPOTENCY_CONFLICT" as const };

    const reversal = await tx.journalTransaction.create({
      data: {
        treasuryId: input.treasuryId, type: "REVERSAL", description: `Obligation cancellation: ${input.reason}`,
        idempotencyKey: input.idempotencyKey, createdById: input.actorId, reversalOfId: original.id,
      },
    });
    await tx.ledgerPosting.createMany({ data: original.postings.map((posting) => ({
      treasuryId: input.treasuryId, journalTransactionId: reversal.id, accountId: posting.accountId,
      side: posting.side === "DEBIT" ? "CREDIT" : "DEBIT", amountMinor: posting.amountMinor,
    })) });
    await tx.journalTransaction.update({ where: { id: reversal.id }, data: { status: "POSTED", postedAt: new Date() } });
    const cancelled = await tx.obligation.update({
      where: { id: obligation.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: input.reason },
    });
    await tx.financialAuditEvent.create({
      data: { treasuryId: input.treasuryId, actorId: input.actorId, action: "OBLIGATION_CANCELLED", entityType: "OBLIGATION", entityId: obligation.id, reason: input.reason, metadata: { reversalTransactionId: reversal.id } },
    });
    return { kind: "CANCELLED" as const, obligation: cancelled };
  });

const obligationInclude = { allocations: { select: { amountMinor: true } }, member: { select: { id: true, firstName: true, lastName: true, email: true } } } as const;

export const listObligations = (treasuryId: string, where: { memberId?: string; cursor?: string; limit: number }) =>
  prisma.obligation.findMany({
    where: { treasuryId, ...(where.memberId ? { memberId: where.memberId } : {}) },
    include: obligationInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(where.cursor ? { cursor: { id: where.cursor }, skip: 1 } : {}),
    take: where.limit,
  });

export const findObligation = (treasuryId: string, obligationId: string) =>
  prisma.obligation.findFirst({ where: { id: obligationId, treasuryId }, include: obligationInclude });

export const findObligationBySource = (treasuryId: string, sourceType: "CONTRIBUTION" | "MATCH_FEE" | "COMPETITION_FEE" | "OTHER", sourceId: string) =>
  prisma.obligation.findUnique({ where: { treasuryId_sourceType_sourceId: { treasuryId, sourceType, sourceId } }, include: { allocations: true } });
