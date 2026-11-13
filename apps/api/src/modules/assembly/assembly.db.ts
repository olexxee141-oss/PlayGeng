import { prisma } from "@playgeng/database";
import type { SubmitAssemblyCaseInput } from "./assembly.validator.js";

export const submitCase = async (communityId: string, requesterId: string, input: SubmitAssemblyCaseInput) =>
  prisma.$transaction(async (tx) => {
    // Serialize against community membership changes and assessment issuance.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE "communities" SET "updatedAt" = "updatedAt"
      WHERE "id" = ${communityId} AND "status" = 'ACTIVE'
      RETURNING "id"
    `;
    if (locked.length !== 1) return { kind: "COMMUNITY_NOT_FOUND" as const };

    const membership = await tx.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId: requesterId } },
      include: { user: { select: { status: true } } },
    });
    if (!membership || membership.user.status !== "ACTIVE") return { kind: "NOT_MEMBER" as const };

    const snapshot = await tx.contributionAssessmentMember.findFirst({
      where: {
        id: input.assessmentMemberId,
        memberId: requesterId,
        assessment: { is: { communityId, status: "ISSUED" } },
      },
      include: { obligation: { select: { id: true, status: true } } },
    });
    if (!snapshot || !snapshot.obligation) return { kind: "ASSESSMENT_NOT_FOUND" as const };
    if (snapshot.obligation.status === "CANCELLED") return { kind: "OBLIGATION_CANCELLED" as const };

    const existing = await tx.assemblyCase.findFirst({
      where: { assessmentMemberId: snapshot.id, status: "SUBMITTED" },
      select: { id: true },
    });
    if (existing) return { kind: "CASE_ALREADY_EXISTS" as const };

    const created = await tx.assemblyCase.create({
      data: {
        communityId,
        assessmentMemberId: snapshot.id,
        requesterId,
        reason: input.reason,
        events: { create: { actorId: requesterId, type: "SUBMITTED" } },
      },
      select: {
        id: true,
        communityId: true,
        assessmentMemberId: true,
        reason: true,
        status: true,
        submittedAt: true,
      },
    });
    return { kind: "CREATED" as const, case: created };
  }, { isolationLevel: "Serializable" });

export const listMyCases = (communityId: string, requesterId: string) =>
  prisma.assemblyCase.findMany({
    where: { communityId, requesterId },
    select: {
      id: true,
      assessmentMemberId: true,
      reason: true,
      status: true,
      submittedAt: true,
      withdrawnAt: true,
    },
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
  });

export const withdrawCase = (communityId: string, caseId: string, requesterId: string) =>
  prisma.$transaction(async (tx) => {
    const updated = await tx.assemblyCase.updateMany({
      where: { id: caseId, communityId, requesterId, status: "SUBMITTED", conflictReviewStartedAt: null, electorateFrozenAt: null },
      data: { status: "WITHDRAWN", withdrawnAt: new Date() },
    });
    if (updated.count !== 1) return false;
    await tx.assemblyCaseEvent.create({
      data: { caseId, actorId: requesterId, type: "WITHDRAWN" },
    });
    return true;
  }, { isolationLevel: "Serializable" });
