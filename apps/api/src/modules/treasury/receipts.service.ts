import { prisma } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import * as db from "./receipts.db.js";
import * as treasuryDb from "./treasury.db.js";
import type { CreateManualReceiptInput } from "./receipts.validator.js";

const requireActiveMember = async (communityId: string, userId: string) => {
  const membership = await treasuryDb.findCommunityAccess(communityId, userId);
  if (!membership || membership.user.status !== "ACTIVE" || membership.community.status !== "ACTIVE") {
    throw new AppError("Community not found.", 404);
  }
  return membership;
};

const requireTreasurer = async (communityId: string, userId: string) => {
  const membership = await requireActiveMember(communityId, userId);
  if (membership.role !== "TREASURER") throw new AppError("Only the elected Treasurer can verify manual receipts.", 403);
};

const present = <T extends {
  amountMinor: bigint;
  allocations: { id: string; obligationId: string; amountMinor: bigint; createdAt: Date; obligation: { id: string; description: string; amountMinor: bigint; dueAt: Date | null; status: string } }[];
}>(receipt: T) => ({
  ...receipt,
  amountMinor: receipt.amountMinor.toString(),
  allocations: receipt.allocations.map((allocation) => ({
    ...allocation,
    amountMinor: allocation.amountMinor.toString(),
    obligation: { ...allocation.obligation, amountMinor: allocation.obligation.amountMinor.toString() },
  })),
});

const assertSameRequest = (receipt: Awaited<ReturnType<typeof db.findReceiptByIdempotency>>, input: CreateManualReceiptInput) => {
  if (!receipt) throw new AppError("Receipt idempotency conflict.", 409);
  const expected = input.allocations.map((item) => ({ obligationId: item.obligationId, amountMinor: item.amountMinor })).sort((a, b) => a.obligationId.localeCompare(b.obligationId));
  const actual = receipt.allocations.map((item) => ({ obligationId: item.obligationId, amountMinor: item.amountMinor.toString() })).sort((a, b) => a.obligationId.localeCompare(b.obligationId));
  if (
    receipt.memberId !== input.memberId ||
    receipt.externalReference !== input.externalReference ||
    receipt.evidenceReference !== input.evidenceReference ||
    receipt.amountMinor !== BigInt(input.amountMinor) ||
    receipt.receivedAt.toISOString() !== new Date(input.receivedAt).toISOString() ||
    JSON.stringify(expected) !== JSON.stringify(actual)
  ) throw new AppError("Receipt idempotency key has already been used with different details.", 409);
  return present(receipt);
};

export const verifyManualReceipt = async (communityId: string, actorId: string, input: CreateManualReceiptInput) => {
  await requireTreasurer(communityId, actorId);
  const treasury = await treasuryDb.findTreasury(communityId);
  if (!treasury) throw new AppError("Community treasury has not been initialized.", 404);
  const member = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId: input.memberId } },
    include: { user: { select: { status: true } } },
  });
  if (!member || member.user.status !== "ACTIVE") throw new AppError("Receipt recipient must be an active community member.", 400);

  let result;
  try {
    result = await db.createManualReceipt({ treasuryId: treasury.id, currency: treasury.currency, actorId, data: input });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const existing = await db.findReceiptByIdempotency(treasury.id, input.idempotencyKey);
      if (existing) return assertSameRequest(existing, input);
      throw new AppError("Receipt external reference or allocation identity already exists.", 409);
    }
    throw error;
  }

  if (result.kind === "EXISTS") return assertSameRequest(await db.findReceiptByIdempotency(treasury.id, input.idempotencyKey), input);
  if (result.kind === "DUPLICATE_OBLIGATION") throw new AppError("Each obligation can appear only once in a receipt allocation.", 400);
  if (result.kind === "OBLIGATION_NOT_FOUND") throw new AppError("One or more obligations were not found in this treasury.", 404);
  if (result.kind === "OBLIGATION_SCOPE_MISMATCH") throw new AppError("All allocated obligations must belong to the receipt member and this community.", 400);
  if (result.kind === "ALLOCATION_TOTAL_MISMATCH") throw new AppError("Allocations must add up exactly to the verified receipt amount.", 400);
  if (result.kind === "OBLIGATION_CANCELLED") throw new AppError("A cancelled obligation cannot receive an allocation.", 409);
  if (result.kind === "OBLIGATION_OVERALLOCATED") throw new AppError("An allocation exceeds the obligation's outstanding amount.", 409);
  return present(result.receipt);
};

export const listMine = async (communityId: string, userId: string, cursor?: string, limit = 50) => {
  await requireActiveMember(communityId, userId);
  const treasury = await treasuryDb.findTreasury(communityId);
  if (!treasury) throw new AppError("Community treasury has not been initialized.", 404);
  return (await db.listReceipts(treasury.id, { memberId: userId, ...(cursor ? { cursor } : {}), limit })).map(present);
};

export const listForFinance = async (communityId: string, userId: string, cursor?: string, limit = 50) => {
  const membership = await requireActiveMember(communityId, userId);
  if (membership.role !== "TREASURER" && membership.role !== "ADMIN") throw new AppError("You do not have permission to inspect community receipts.", 403);
  const treasury = await treasuryDb.findTreasury(communityId);
  if (!treasury) throw new AppError("Community treasury has not been initialized.", 404);
  return (await db.listReceipts(treasury.id, { ...(cursor ? { cursor } : {}), limit })).map(present);
};

export const getOne = async (communityId: string, userId: string, receiptId: string) => {
  const membership = await requireActiveMember(communityId, userId);
  const treasury = await treasuryDb.findTreasury(communityId);
  if (!treasury) throw new AppError("Community treasury has not been initialized.", 404);
  const receipt = await db.findReceipt(treasury.id, receiptId);
  if (!receipt) throw new AppError("Receipt not found.", 404);
  if (receipt.memberId !== userId && membership.role !== "TREASURER" && membership.role !== "ADMIN") {
    throw new AppError("You do not have permission to view this receipt.", 403);
  }
  return present(receipt);
};
