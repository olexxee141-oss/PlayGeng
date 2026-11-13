import { resolveConflictDetermination } from "./assembly.conflicts.policy.js";
import { prisma, type Prisma } from "@playgeng/database";

const isSerializationConflict = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "P2034") return true;
  if ("meta" in error && typeof error.meta === "object" && error.meta !== null && "code" in error.meta && String(error.meta.code) === "40001") return true;
  if ("originalCode" in error && String(error.originalCode) === "40001") return true;
  if ("kind" in error && error.kind === "TransactionWriteConflict") return true;
  if ("message" in error && typeof error.message === "string" && /serialization failure|could not serialize access|TransactionWriteConflict|40001/i.test(error.message)) return true;
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

const requirePrimaryReviewer = async (tx: Prisma.TransactionClient, communityId: string, userId: string) => {
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

export const declareConflict = (communityId: string, caseId: string, declarantId: string, input: { subjectUserId: string; reason: string }) =>
  withAssemblyTransaction(async (tx) => {
    if (!await lockCommunity(tx, communityId)) return { kind: "NOT_FOUND" as const };
    const item = await tx.assemblyCase.findFirst({ where: { id: caseId, communityId, status: "SUBMITTED" } });
    if (!item) return { kind: "CASE_NOT_FOUND" as const };
    if (item.conflictReviewStartedAt || item.electorateFrozenAt) return { kind: "DECLARATIONS_CLOSED" as const };
    const [declarant, subject] = await Promise.all([
      tx.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: declarantId } }, include: { user: { select: { status: true } } } }),
      tx.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: input.subjectUserId } }, include: { user: { select: { status: true } } } }),
    ]);
    if (!declarant || declarant.user.status !== "ACTIVE") return { kind: "NOT_MEMBER" as const };
    if (!subject || subject.user.status !== "ACTIVE") return { kind: "SUBJECT_NOT_MEMBER" as const };
    if (item.requesterId === input.subjectUserId) return { kind: "REQUESTER_SUBJECT" as const };
    const created = await tx.assemblyConflictDeclaration.create({
      data: { caseId, declarantId, subjectUserId: input.subjectUserId, reason: input.reason },
      select: { id: true, caseId: true, declarantId: true, subjectUserId: true, reason: true, status: true, createdAt: true },
    });
    return { kind: "CREATED" as const, declaration: created };
  });

export const withdrawConflictDeclaration = (communityId: string, caseId: string, declarationId: string, declarantId: string) =>
  withAssemblyTransaction(async (tx) => {
    if (!await lockCommunity(tx, communityId)) return { kind: "NOT_FOUND" as const };
    const item = await tx.assemblyCase.findFirst({ where: { id: caseId, communityId, status: "SUBMITTED" } });
    if (!item) return { kind: "CASE_NOT_FOUND" as const };
    if (item.conflictReviewStartedAt) return { kind: "DECLARATIONS_CLOSED" as const };
    const declaration = await tx.assemblyConflictDeclaration.findFirst({ where: { id: declarationId, caseId, declarantId, status: "OPEN" } });
    if (!declaration) return { kind: "DECLARATION_NOT_FOUND" as const };
    await tx.assemblyConflictDeclaration.update({ where: { id: declarationId }, data: { status: "WITHDRAWN", withdrawnAt: new Date() } });
    return { kind: "WITHDRAWN" as const };
  });

export const startConflictReview = (communityId: string, caseId: string, actorId: string) =>
  withAssemblyTransaction(async (tx) => {
    if (!await lockCommunity(tx, communityId)) return { kind: "NOT_FOUND" as const };
    const item = await tx.assemblyCase.findFirst({ where: { id: caseId, communityId, status: "SUBMITTED" } });
    if (!item) return { kind: "CASE_NOT_FOUND" as const };
    if (!await requirePrimaryReviewer(tx, communityId, actorId)) return { kind: "NOT_PRIMARY_COUNCIL" as const };
    if (item.requesterId === actorId) return { kind: "REQUESTER_RECUSED" as const };
    if (item.conflictReviewStartedAt) return { kind: "ALREADY_STARTED" as const };
    const now = new Date();
    await tx.assemblyCase.update({ where: { id: caseId }, data: { conflictReviewStartedAt: now } });
    await tx.assemblyCaseEvent.create({ data: { caseId, actorId, type: "CONFLICT_REVIEW_STARTED" } });
    return { kind: "STARTED" as const, startedAt: now };
  });

export const decideConflict = (communityId: string, caseId: string, declarationId: string, reviewerId: string, input: { conflictExists: boolean; reason: string }) =>
  withAssemblyTransaction(async (tx) => {
    if (!await lockCommunity(tx, communityId)) return { kind: "NOT_FOUND" as const };
    const item = await tx.assemblyCase.findFirst({ where: { id: caseId, communityId, status: "SUBMITTED" } });
    if (!item) return { kind: "CASE_NOT_FOUND" as const };
    if (!item.conflictReviewStartedAt || item.electorateFrozenAt) return { kind: "REVIEW_NOT_OPEN" as const };
    const declaration = await tx.assemblyConflictDeclaration.findFirst({ where: { id: declarationId, caseId, status: "OPEN" } });
    if (!declaration) return { kind: "DECLARATION_NOT_FOUND" as const };
    if (!await requirePrimaryReviewer(tx, communityId, reviewerId)) return { kind: "NOT_PRIMARY_COUNCIL" as const };
    if ([item.requesterId, declaration.declarantId, declaration.subjectUserId].includes(reviewerId)) return { kind: "REVIEWER_CONFLICTED" as const };
    const reviewerConflict = await tx.assemblyConflictDeclaration.findFirst({
      where: { caseId, subjectUserId: reviewerId, status: { in: ["OPEN", "CONFLICT_CONFIRMED"] } },
      select: { id: true },
    });
    if (reviewerConflict) return { kind: "REVIEWER_CONFLICTED" as const };
    await tx.assemblyConflictDecision.create({ data: { declarationId, reviewerId, ...input } });

    const eligibleCouncil = await tx.reviewCouncilMember.findMany({
      where: {
        communityId, status: "ACTIVE", seat: "PRIMARY",
        user: { communityMemberships: { some: { communityId, user: { status: "ACTIVE" } } } },
      },
      select: { userId: true },
    });
    const declarations = await tx.assemblyConflictDeclaration.findMany({
      where: { caseId, status: { in: ["OPEN", "CONFLICT_CONFIRMED"] } },
      select: { subjectUserId: true },
    });
    const blocked = new Set([item.requesterId, ...declarations.map((d: { subjectUserId: string }) => d.subjectUserId), declaration.declarantId, declaration.subjectUserId]);
    const eligible = eligibleCouncil.map((m: { userId: string }) => m.userId).filter((id: string) => !blocked.has(id));
    const decisions = await tx.assemblyConflictDecision.findMany({ where: { declarationId }, select: { reviewerId: true, conflictExists: true } });
    const outcome = resolveConflictDetermination(eligible, decisions);
    if (outcome.status) {
      await tx.assemblyConflictDeclaration.update({ where: { id: declarationId }, data: { status: outcome.status, determinedAt: new Date() } });
    }
    return { kind: "RECORDED" as const, ...outcome };
  });

export const freezeElectorate = (communityId: string, caseId: string, actorId: string) =>
  withAssemblyTransaction(async (tx) => {
    if (!await lockCommunity(tx, communityId)) return { kind: "NOT_FOUND" as const };
    const item = await tx.assemblyCase.findFirst({ where: { id: caseId, communityId, status: "SUBMITTED" } });
    if (!item) return { kind: "CASE_NOT_FOUND" as const };
    if (!await requirePrimaryReviewer(tx, communityId, actorId)) return { kind: "NOT_PRIMARY_COUNCIL" as const };
    if (item.requesterId === actorId) return { kind: "REQUESTER_RECUSED" as const };
    if (!item.conflictReviewStartedAt) return { kind: "REVIEW_NOT_STARTED" as const };
    if (item.electorateFrozenAt) return { kind: "ALREADY_FROZEN" as const };
    const unresolved = await tx.assemblyConflictDeclaration.count({ where: { caseId, status: "OPEN" } });
    if (unresolved > 0) return { kind: "UNRESOLVED_CONFLICTS" as const };
    const [members, conflicts] = await Promise.all([
      tx.communityMember.findMany({ where: { communityId, user: { status: "ACTIVE" } }, select: { userId: true } }),
      tx.assemblyConflictDeclaration.findMany({ where: { caseId, status: "CONFLICT_CONFIRMED" }, select: { subjectUserId: true } }),
    ]);
    const conflicted = new Set(conflicts.map((d: { subjectUserId: string }) => d.subjectUserId));
    const rows = members.map((member: { userId: string }) => ({
      caseId, userId: member.userId,
      eligible: member.userId !== item.requesterId && !conflicted.has(member.userId),
      exclusionReason: member.userId === item.requesterId ? "REQUESTER" : conflicted.has(member.userId) ? "MATERIAL_CONFLICT" : null,
    }));
    const eligibleVoterCount = rows.filter((row: { eligible: boolean }) => row.eligible).length;
    if (eligibleVoterCount < 1) return { kind: "NO_ELIGIBLE_VOTERS" as const };
    await tx.assemblyCaseElectorateMember.createMany({ data: rows });
    const now = new Date();
    await tx.assemblyCase.update({ where: { id: caseId }, data: { electorateFrozenAt: now, eligibleVoterCount } });
    await tx.assemblyCaseEvent.create({ data: { caseId, actorId, type: "ELECTORATE_FROZEN" } });
    return { kind: "FROZEN" as const, electorateFrozenAt: now, eligibleVoterCount, totalMembers: rows.length };
  });

export const respondToConflictDeclaration = (communityId: string, caseId: string, declarationId: string, subjectUserId: string, response: string) =>
  withAssemblyTransaction(async (tx) => {
    if (!await lockCommunity(tx, communityId)) return { kind: "NOT_FOUND" as const };
    const item = await tx.assemblyCase.findFirst({ where: { id: caseId, communityId, status: "SUBMITTED" } });
    if (!item) return { kind: "CASE_NOT_FOUND" as const };
    if (item.conflictReviewStartedAt) return { kind: "DECLARATIONS_CLOSED" as const };
    const declaration = await tx.assemblyConflictDeclaration.findFirst({
      where: { id: declarationId, caseId, subjectUserId, status: "OPEN", subjectResponse: null },
      select: { id: true },
    });
    if (!declaration) return { kind: "DECLARATION_NOT_FOUND" as const };
    const updated = await tx.assemblyConflictDeclaration.update({
      where: { id: declarationId },
      data: { subjectResponse: response, respondedAt: new Date() },
      select: { id: true, subjectResponse: true, respondedAt: true },
    });
    return { kind: "RESPONDED" as const, declaration: updated };
  });

export const listMyConflictDeclarations = (communityId: string, caseId: string, userId: string) =>
  prisma.assemblyConflictDeclaration.findMany({
    where: { caseId, assemblyCase: { communityId }, OR: [{ declarantId: userId }, { subjectUserId: userId }] },
    select: { id: true, subjectUserId: true, reason: true, subjectResponse: true, respondedAt: true, status: true, createdAt: true, withdrawnAt: true, determinedAt: true },
    orderBy: { createdAt: "asc" },
  });
