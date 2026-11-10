import { prisma } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import * as db from "./obligations.db.js";
import * as treasuryDb from "./treasury.db.js";
import type { CancelObligationInput, CreateObligationInput } from "./obligations.validator.js";

const requireActiveMember = async (communityId: string, userId: string) => {
  const membership = await treasuryDb.findCommunityAccess(communityId, userId);
  if (!membership || membership.user.status !== "ACTIVE" || membership.community.status !== "ACTIVE") throw new AppError("Community not found.", 404);
  return membership;
};

const requireTreasurer = async (communityId: string, userId: string) => {
  const membership = await requireActiveMember(communityId, userId);
  if (membership.role !== "TREASURER") throw new AppError("Only the elected Treasurer can manage obligations.", 403);
};

const present = (obligation: { amountMinor: bigint; dueAt: Date | null; status: string; allocations: { amountMinor: bigint }[] }) => {
  const allocated = obligation.allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0n);
  const outstanding = obligation.amountMinor - allocated;
  const status = obligation.status === "CANCELLED" ? "CANCELLED" : outstanding === 0n ? "PAID" : allocated > 0n ? "PARTIALLY_PAID" : obligation.dueAt && obligation.dueAt < new Date() ? "OVERDUE" : "OPEN";
  return { ...obligation, amountMinor: obligation.amountMinor.toString(), allocatedMinor: allocated.toString(), outstandingMinor: outstanding.toString(), status };
};

export const create = async (communityId: string, actorId: string, input: CreateObligationInput) => {
  await requireTreasurer(communityId, actorId);
  const treasury = await treasuryDb.findTreasury(communityId);
  if (!treasury) throw new AppError("Community treasury has not been initialized.", 404);
  const member = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId: input.memberId } },
    include: { user: { select: { status: true } } },
  });
  if (!member || member.user.status !== "ACTIVE") throw new AppError("Obligation recipient must be an active community member.", 400);
  const result = await db.createObligation({ treasuryId: treasury.id, actorId, memberId: input.memberId, data: input });
  if (result.kind === "EXISTS") {
    const existing = result.obligation;
    const same = existing.memberId === input.memberId && existing.sourceType === input.sourceType && existing.sourceId === input.sourceId &&
      existing.description === input.description && existing.amountMinor === BigInt(input.amountMinor) &&
      (existing.dueAt?.toISOString() ?? null) === (input.dueAt ? new Date(input.dueAt).toISOString() : null);
    if (!same) throw new AppError("Obligation source or idempotency key already exists with different details.", 409);
    return present(existing);
  }
  return present({ ...result.obligation, allocations: [] });
};

export const cancel = async (communityId: string, actorId: string, obligationId: string, input: CancelObligationInput) => {
  await requireTreasurer(communityId, actorId);
  const treasury = await treasuryDb.findTreasury(communityId);
  if (!treasury) throw new AppError("Community treasury has not been initialized.", 404);
  const result = await db.cancelObligation({ treasuryId: treasury.id, obligationId, actorId, ...input });
  if (result.kind === "NOT_FOUND") throw new AppError("Obligation not found.", 404);
  if (result.kind === "ALREADY_CANCELLED") throw new AppError("Obligation is already cancelled.", 409);
  if (result.kind === "SETTLED") throw new AppError("An obligation with receipt allocations cannot be cancelled; use the audited refund or reversal workflow.", 409);
  if (result.kind === "IDEMPOTENCY_CONFLICT") throw new AppError("Idempotency key has already been used.", 409);
  return result.obligation;
};

export const listForMember = async (communityId: string, userId: string, cursor?: string, limit = 50) => {
  await requireActiveMember(communityId, userId);
  const treasury = await treasuryDb.findTreasury(communityId);
  if (!treasury) throw new AppError("Community treasury has not been initialized.", 404);
  const rows = await db.listObligations(treasury.id, { memberId: userId, cursor, limit });
  return rows.map(present);
};

export const listForFinance = async (communityId: string, userId: string, cursor?: string, limit = 50) => {
  const membership = await requireActiveMember(communityId, userId);
  if (membership.role !== "TREASURER" && membership.role !== "ADMIN") throw new AppError("You do not have permission to inspect community obligations.", 403);
  const treasury = await treasuryDb.findTreasury(communityId);
  if (!treasury) throw new AppError("Community treasury has not been initialized.", 404);
  const rows = await db.listObligations(treasury.id, { cursor, limit });
  return rows.map(present);
};

export const getOne = async (communityId: string, userId: string, obligationId: string) => {
  const membership = await requireActiveMember(communityId, userId);
  const treasury = await treasuryDb.findTreasury(communityId);
  if (!treasury) throw new AppError("Community treasury has not been initialized.", 404);
  const row = await db.findObligation(treasury.id, obligationId);
  if (!row) throw new AppError("Obligation not found.", 404);
  if (row.memberId !== userId && membership.role !== "TREASURER" && membership.role !== "ADMIN") throw new AppError("You do not have permission to view this obligation.", 403);
  return present(row);
};
