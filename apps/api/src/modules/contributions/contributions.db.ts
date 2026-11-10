import { prisma, type Prisma } from "@playgeng/database";

export const findAccess = (communityId: string, userId: string) =>
  prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    include: { user: { select: { status: true } }, community: { select: { status: true, timezone: true } } },
  });

export const findTreasury = (communityId: string) =>
  prisma.treasury.findUnique({ where: { communityId }, select: { id: true, currency: true } });

export const listCampaigns = (communityId: string) =>
  prisma.contributionCampaign.findMany({
    where: { communityId },
    include: { _count: { select: { assessments: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

export const findCampaign = (communityId: string, campaignId: string) =>
  prisma.contributionCampaign.findFirst({
    where: { id: campaignId, communityId },
    include: { events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }, _count: { select: { assessments: true } } },
  });

export const createCampaign = (data: Prisma.ContributionCampaignUncheckedCreateInput) =>
  prisma.contributionCampaign.create({ data });

export const updateCampaign = (communityId: string, campaignId: string, data: Prisma.ContributionCampaignUpdateManyMutationInput) =>
  prisma.$transaction(async (tx) => {
    const updated = await tx.contributionCampaign.updateMany({ where: { id: campaignId, communityId, status: "ACTIVE" }, data });
    if (updated.count !== 1) return null;
    return tx.contributionCampaign.findFirst({ where: { id: campaignId, communityId } });
  }, { isolationLevel: "Serializable" });

export const transitionCampaign = async (input: {
  communityId: string; campaignId: string; actorId: string; reason: string;
  event: "PAUSED" | "RESUMED" | "ENDED" | "CANCELLED";
}) => prisma.$transaction(async (tx) => {
  const campaign = await tx.contributionCampaign.findFirst({
    where: { id: input.campaignId, communityId: input.communityId },
    include: { assessments: { where: { status: "ISSUED" }, select: { id: true }, take: 1 } },
  });
  if (!campaign) return { kind: "NOT_FOUND" as const };
  const next = {
    PAUSED: campaign.status === "ACTIVE",
    RESUMED: campaign.status === "PAUSED",
    ENDED: campaign.status === "ACTIVE" || campaign.status === "PAUSED",
    CANCELLED: (campaign.status === "ACTIVE" || campaign.status === "PAUSED") && campaign.assessments.length === 0,
  }[input.event];
  if (!next) return { kind: "INVALID_STATE" as const };
  const now = new Date();
  const updated = await tx.contributionCampaign.update({
    where: { id: campaign.id },
    data: input.event === "PAUSED" ? { status: "PAUSED", pausedAt: now }
      : input.event === "RESUMED" ? { status: "ACTIVE", pausedAt: null }
      : input.event === "ENDED" ? { status: "ENDED", endedAt: now }
      : { status: "CANCELLED", cancelledAt: now },
  });
  await tx.contributionCampaignEvent.create({
    data: { campaignId: campaign.id, actorId: input.actorId, type: input.event, reason: input.reason, createdAt: now },
  });
  return { kind: "UPDATED" as const, campaign: updated };
}, { isolationLevel: "Serializable" });

export const createAssessment = (data: Prisma.ContributionAssessmentUncheckedCreateInput) =>
  prisma.contributionAssessment.create({ data });

export const listAssessments = (communityId: string, campaignId?: string) =>
  prisma.contributionAssessment.findMany({
    where: { communityId, ...(campaignId ? { campaignId } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

export const findAssessment = (communityId: string, assessmentId: string) =>
  prisma.contributionAssessment.findFirst({ where: { communityId, id: assessmentId } });

export const updateDraftAssessment = (communityId: string, assessmentId: string, data: Prisma.ContributionAssessmentUpdateManyMutationInput) =>
  prisma.$transaction(async (tx) => {
    const updated = await tx.contributionAssessment.updateMany({
      where: { id: assessmentId, communityId, status: "DRAFT" }, data,
    });
    if (updated.count !== 1) return null;
    return tx.contributionAssessment.findFirst({ where: { id: assessmentId, communityId } });
  }, { isolationLevel: "Serializable" });

export const listAutomaticCampaigns = () =>
  prisma.contributionCampaign.findMany({
    where: { status: { in: ["ACTIVE", "PAUSED", "ENDED"] }, frequency: "MONTHLY", assessmentGenerationMode: "AUTOMATIC", community: { status: "ACTIVE" } },
    include: { community: { select: { timezone: true, treasury: { select: { currency: true } } } }, events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
  });

export const createScheduledDraft = async (input: {
  campaignId: string; communityId: string; periodKey: string; boundary: Date; timezone: string;
}) => {
  try {
    return await prisma.$transaction(async (tx) => {
      // Serialize draft generation against campaign pause/resume/end/configuration writes.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE "contribution_campaigns" SET "updatedAt" = "updatedAt"
        WHERE "id" = ${input.campaignId} AND "communityId" = ${input.communityId}
        RETURNING "id"
      `;
      if (locked.length !== 1) return null;
      const campaign = await tx.contributionCampaign.findUnique({
        where: { id: input.campaignId },
        include: {
          community: { select: { timezone: true, status: true, treasury: { select: { currency: true } } } },
          events: { where: { createdAt: { lte: input.boundary } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        },
      });
      if (!campaign || campaign.community.status !== "ACTIVE" || campaign.community.timezone !== input.timezone ||
        campaign.frequency !== "MONTHLY" || campaign.assessmentGenerationMode !== "AUTOMATIC" ||
        campaign.status === "CANCELLED" || campaign.createdAt >= input.boundary ||
        (campaign.endedAt !== null && campaign.endedAt <= input.boundary) ||
        campaign.events.at(-1)?.type === "PAUSED" || campaign.events.at(-1)?.type === "ENDED" ||
        campaign.events.at(-1)?.type === "CANCELLED" || !campaign.community.treasury) return null;
      return await tx.contributionAssessment.create({
        data: {
          campaignId: campaign.id,
          communityId: campaign.communityId,
          periodKey: input.periodKey,
          description: campaign.description ?? campaign.name,
          amountMinor: campaign.amountMinor,
          currency: campaign.community.treasury.currency,
          dueAt: null,
          status: "DRAFT",
          createdById: campaign.createdById,
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return null;
    throw error;
  }
};


export const listMyContributionSnapshots = (communityId: string, memberId: string, cursor?: string, limit = 25) =>
  prisma.contributionAssessmentMember.findMany({
    where: { memberId, assessment: { is: { communityId } } },
    include: {
      assessment: { include: { campaign: { select: { id: true, name: true, frequency: true } } } },
      obligation: { include: { allocations: { select: { amountMinor: true } } } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit + 1,
  });

export const findAssessmentReport = (communityId: string, assessmentId: string) =>
  prisma.contributionAssessment.findFirst({
    where: { communityId, id: assessmentId },
    include: {
      campaign: { select: { id: true, name: true, frequency: true } },
      _count: { select: { members: true } },
      members: {
        include: {
          obligation: { include: { allocations: { select: { amountMinor: true } } } },
        },
      },
    },
  });

export const listAssessmentSnapshotMembers = (assessmentId: string, cursor?: string, limit = 25) =>
  prisma.contributionAssessmentMember.findMany({
    where: { assessmentId },
    include: { obligation: { include: { allocations: { select: { amountMinor: true } } } } },
    orderBy: [{ snapshotAt: "asc" }, { id: "asc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit + 1,
  });

export const findUserStatus = (userId: string) =>
  prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
