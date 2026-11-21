import { prisma, type Prisma } from "@playgeng/database";
import { resolveAssemblyOutcome } from "./assembly.voting.policy.js";

const isSerializationConflict = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "P2034") return true;
  return "cause" in error && isSerializationConflict(error.cause);
};

const withAssemblyTransaction = async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { return await prisma.$transaction(work, { isolationLevel: "Serializable" }); }
    catch (error) {
      if (!isSerializationConflict(error) || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
  throw new Error("Assembly transaction retry limit reached.");
};

const lockCommunity = async (tx: Prisma.TransactionClient, communityId: string) => {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    UPDATE "communities" SET "updatedAt" = "updatedAt"
    WHERE "id" = ${communityId} AND "status" = 'ACTIVE'
    RETURNING "id"
  `;
  return rows.length === 1;
};

const requirePrimaryCouncil = async (tx: Prisma.TransactionClient, communityId: string, userId: string) => {
  const membership = await tx.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    include: { user: { select: { status: true } } },
  });
  if (!membership || membership.user.status !== "ACTIVE") return false;
  const council = await tx.reviewCouncilMember.findFirst({
    where: { communityId, userId, status: "ACTIVE", seat: "PRIMARY" },
    select: { id: true },
  });
  return Boolean(council);
};

const isConflictParticipant = async (tx: Prisma.TransactionClient, caseId: string, userId: string) =>
  Boolean(await tx.assemblyConflictDeclaration.findFirst({
    where: { caseId, status: { in: ["OPEN", "CONFLICT_CONFIRMED"] }, OR: [{ declarantId: userId }, { subjectUserId: userId }] },
    select: { id: true },
  }));

const requireLifecycleAuthority = async (tx: Prisma.TransactionClient, communityId: string, item: { requesterId: string; id: string }, actorId: string) => {
  if (!await requirePrimaryCouncil(tx, communityId, actorId)) return "NOT_PRIMARY_COUNCIL" as const;
  if (item.requesterId === actorId) return "REQUESTER_RECUSED" as const;
  if (await isConflictParticipant(tx, item.id, actorId)) return "REVIEWER_CONFLICTED" as const;
  return null;
};

export const publishAssemblyNotice = (communityId: string, caseId: string, actorId: string) =>
  withAssemblyTransaction(async (tx) => {
    if (!await lockCommunity(tx, communityId)) return { kind: "NOT_FOUND" as const };
    const item = await tx.assemblyCase.findFirst({ where: { id: caseId, communityId } });
    if (!item) return { kind: "CASE_NOT_FOUND" as const };
    const denied = await requireLifecycleAuthority(tx, communityId, item, actorId);
    if (denied) return { kind: denied };
    if (!item.electorateFrozenAt || !item.eligibleVoterCount) return { kind: "ELECTORATE_NOT_FROZEN" as const };
    if (item.status !== "SUBMITTED") return { kind: "NOTICE_NOT_AVAILABLE" as const };
    const now = new Date();
    await tx.assemblyCase.update({ where: { id: caseId }, data: { status: "NOTICE_PUBLISHED", noticePublishedAt: now, noticeOpensAt: now } });
    await tx.assemblyCaseEvent.create({ data: { caseId, actorId, type: "NOTICE_PUBLISHED" } });
    return { kind: "PUBLISHED" as const, noticePublishedAt: now, earliestVotingAt: new Date(now.getTime() + 48 * 60 * 60 * 1000) };
  });

export const openAssemblyVoting = (communityId: string, caseId: string, actorId: string) =>
  withAssemblyTransaction(async (tx) => {
    if (!await lockCommunity(tx, communityId)) return { kind: "NOT_FOUND" as const };
    const item = await tx.assemblyCase.findFirst({ where: { id: caseId, communityId } });
    if (!item) return { kind: "CASE_NOT_FOUND" as const };
    const denied = await requireLifecycleAuthority(tx, communityId, item, actorId);
    if (denied) return { kind: denied };
    if (item.status !== "NOTICE_PUBLISHED" || !item.noticeOpensAt) return { kind: "VOTING_NOT_AVAILABLE" as const };
    const now = new Date();
    const earliest = new Date(item.noticeOpensAt.getTime() + 48 * 60 * 60 * 1000);
    if (now < earliest) return { kind: "NOTICE_PERIOD_ACTIVE" as const, earliestVotingAt: earliest };
    const closesAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);
    await tx.assemblyCase.update({ where: { id: caseId }, data: { status: "VOTING_OPEN", votingOpenedAt: now, votingClosesAt: closesAt } });
    await tx.assemblyCaseEvent.create({ data: { caseId, actorId, type: "VOTING_OPENED" } });
    return { kind: "OPENED" as const, votingOpenedAt: now, votingClosesAt: closesAt };
  });

export const castAssemblyBallot = (communityId: string, caseId: string, voterId: string, vote: "YES" | "NO") =>
  withAssemblyTransaction(async (tx) => {
    const item = await tx.assemblyCase.findFirst({ where: { id: caseId, communityId }, select: { id: true, status: true, votingOpenedAt: true, votingClosesAt: true } });
    if (!item) return { kind: "CASE_NOT_FOUND" as const };
    const now = new Date();
    if (item.status !== "VOTING_OPEN" || !item.votingOpenedAt || !item.votingClosesAt || now < item.votingOpenedAt || now >= item.votingClosesAt) return { kind: "VOTING_CLOSED" as const };
    const electorate = await tx.assemblyCaseElectorateMember.findFirst({ where: { caseId, userId: voterId, eligible: true }, select: { id: true } });
    if (!electorate) return { kind: "NOT_ELIGIBLE" as const };
    const ballot = await tx.assemblyCaseBallot.create({ data: { caseId, voterId, vote }, select: { id: true, vote: true, castAt: true } });
    await tx.assemblyCaseEvent.create({ data: { caseId, actorId: voterId, type: "BALLOT_CAST" } });
    return { kind: "CAST" as const, ballot };
  });

export const finalizeAssemblyVoting = (communityId: string, caseId: string, actorId: string) =>
  withAssemblyTransaction(async (tx) => {
    if (!await lockCommunity(tx, communityId)) return { kind: "NOT_FOUND" as const };
    const item = await tx.assemblyCase.findFirst({ where: { id: caseId, communityId } });
    if (!item) return { kind: "CASE_NOT_FOUND" as const };
    const denied = await requireLifecycleAuthority(tx, communityId, item, actorId);
    if (denied) return { kind: denied };
    if (item.status !== "VOTING_OPEN" || !item.votingClosesAt || !item.eligibleVoterCount) return { kind: "OUTCOME_NOT_AVAILABLE" as const };
    const now = new Date();
    if (now < item.votingClosesAt) return { kind: "VOTING_STILL_OPEN" as const, votingClosesAt: item.votingClosesAt };
    const grouped = await tx.assemblyCaseBallot.groupBy({ by: ["vote"], where: { caseId }, _count: { _all: true } });
    const yesVoteCount = grouped.find((row) => row.vote === "YES")?._count._all ?? 0;
    const noVoteCount = grouped.find((row) => row.vote === "NO")?._count._all ?? 0;
    const outcome = resolveAssemblyOutcome({ eligibleVoterCount: item.eligibleVoterCount, yesVoteCount, noVoteCount });
    await tx.assemblyCase.update({
      where: { id: caseId },
      data: {
        status: outcome.status,
        outcomeRecordedAt: now,
        approvedAt: outcome.approved ? now : null,
        rejectedAt: outcome.approved ? null : now,
        yesVoteCount,
        noVoteCount,
        quorumRequired: outcome.quorumRequired,
      },
    });
    await tx.assemblyCaseEvent.createMany({ data: [
      { caseId, actorId, type: "VOTING_CLOSED" },
      { caseId, actorId, type: "OUTCOME_RECORDED" },
    ] });
    return { kind: "FINALIZED" as const, finalizedAt: now, yesVoteCount, noVoteCount, ...outcome };
  });

export const getAssemblyVotingStatus = async (communityId: string, caseId: string, viewerId: string) => {
  const item = await prisma.assemblyCase.findFirst({
    where: { id: caseId, communityId },
    select: {
      id: true, requesterId: true, status: true, noticePublishedAt: true, noticeOpensAt: true,
      votingOpenedAt: true, votingClosesAt: true, outcomeRecordedAt: true, approvedAt: true, rejectedAt: true,
      eligibleVoterCount: true, yesVoteCount: true, noVoteCount: true, quorumRequired: true,
    },
  });
  if (!item) return { kind: "CASE_NOT_FOUND" as const };
  const electorate = await prisma.assemblyCaseElectorateMember.findFirst({ where: { caseId, userId: viewerId }, select: { eligible: true } });
  const ballot = await prisma.assemblyCaseBallot.findFirst({ where: { caseId, voterId: viewerId }, select: { vote: true, castAt: true } });
  return { kind: "STATUS" as const, ...item, viewerEligible: electorate?.eligible ?? false, viewerBallot: ballot };
};
