import { AppError } from "../../shared/errors/app-error.js";
import * as db from "./contributions.db.js";
import type { CreateAssessmentInput, CreateCampaignInput, UpdateAssessmentInput, UpdateCampaignInput } from "./contributions.validator.js";

const requireMember = async (communityId: string, userId: string) => {
  const access = await db.findAccess(communityId, userId);
  if (!access || access.user.status !== "ACTIVE" || access.community.status !== "ACTIVE") throw new AppError("Community not found.", 404);
  return access;
};

const requireAdmin = async (communityId: string, userId: string) => {
  const access = await requireMember(communityId, userId);
  if (access.role !== "ADMIN") throw new AppError("Only an elected community ADMIN can administer contribution campaigns.", 403);
  return access;
};

const presentCampaign = (campaign: any) => ({
  ...campaign,
  amountMinor: campaign.amountMinor.toString(),
});

const presentAssessment = (assessment: any) => ({
  ...assessment,
  amountMinor: assessment.amountMinor.toString(),
});

export const createCampaign = async (communityId: string, actorId: string, input: CreateCampaignInput) => {
  await requireAdmin(communityId, actorId);
  const treasury = await db.findTreasury(communityId);
  if (!treasury) throw new AppError("Initialize the community Treasury before creating a contribution campaign.", 409);
  const campaign = await db.createCampaign({
    communityId,
    name: input.name,
    description: input.description ?? null,
    amountMinor: BigInt(input.amountMinor),
    frequency: input.frequency,
    assessmentGenerationMode: input.frequency === "MONTHLY" ? (input.assessmentGenerationMode ?? "MANUAL") : "MANUAL",
    createdById: actorId,
  });
  return { ...presentCampaign(campaign), currency: treasury.currency };
};

export const listCampaigns = async (communityId: string, userId: string) => {
  const access = await requireMember(communityId, userId);
  const campaigns = await db.listCampaigns(communityId);
  return campaigns.map((campaign) => ({ ...presentCampaign(campaign), canAdminister: access.role === "ADMIN" }));
};

export const getCampaign = async (communityId: string, userId: string, campaignId: string) => {
  await requireMember(communityId, userId);
  const campaign = await db.findCampaign(communityId, campaignId);
  if (!campaign) throw new AppError("Contribution campaign not found.", 404);
  return presentCampaign(campaign);
};

export const updateCampaign = async (communityId: string, actorId: string, campaignId: string, input: UpdateCampaignInput) => {
  await requireAdmin(communityId, actorId);
  const existing = await db.findCampaign(communityId, campaignId);
  if (!existing) throw new AppError("Contribution campaign not found.", 404);
  if (existing.status !== "ACTIVE") throw new AppError("Only active campaigns can be configured.", 409);
  const updated = await db.updateCampaign(communityId, campaignId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.amountMinor !== undefined ? { amountMinor: BigInt(input.amountMinor) } : {}),
    ...(input.assessmentGenerationMode !== undefined && existing.frequency === "MONTHLY" ? { assessmentGenerationMode: input.assessmentGenerationMode } : {}),
  });
  if (!updated) throw new AppError("Campaign state changed; reload and try again.", 409);
  return presentCampaign(updated);
};

export const transitionCampaign = async (communityId: string, actorId: string, campaignId: string, event: "PAUSED" | "RESUMED" | "ENDED" | "CANCELLED", reason: string) => {
  await requireAdmin(communityId, actorId);
  const result = await db.transitionCampaign({ communityId, campaignId, actorId, event, reason });
  if (result.kind === "NOT_FOUND") throw new AppError("Contribution campaign not found.", 404);
  if (result.kind === "INVALID_STATE") throw new AppError(event === "CANCELLED" ? "A campaign can only be cancelled before its first assessment is issued." : "This campaign cannot make that transition.", 409);
  return presentCampaign(result.campaign);
};

export const createAssessment = async (communityId: string, actorId: string, campaignId: string, input: CreateAssessmentInput) => {
  await requireAdmin(communityId, actorId);
  const campaign = await db.findCampaign(communityId, campaignId);
  if (!campaign || campaign.status !== "ACTIVE") throw new AppError("An active contribution campaign is required.", 404);
  if (campaign.frequency === "ONE_OFF" && input.periodKey !== "ONE_OFF") throw new AppError("One-off campaigns require the ONE_OFF period key.", 400);
  if (campaign.frequency === "MONTHLY" && input.periodKey === "ONE_OFF") throw new AppError("Monthly campaigns require a YYYY-MM period key.", 400);
  if (campaign.frequency === "MONTHLY" && campaign.assessmentGenerationMode === "AUTOMATIC") throw new AppError("This campaign generates monthly drafts automatically; use the generated occurrence.", 409);
  const treasury = await db.findTreasury(communityId);
  if (!treasury) throw new AppError("Community Treasury has not been initialized.", 409);
  try {
    const assessment = await db.createAssessment({
      campaignId,
      communityId,
      periodKey: input.periodKey,
      description: input.description ?? campaign.name,
      amountMinor: campaign.amountMinor,
      currency: treasury.currency,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      createdById: actorId,
    });
    return presentAssessment(assessment);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") throw new AppError("An assessment already exists for this campaign period.", 409);
    throw error;
  }
};

export const listAssessments = async (communityId: string, userId: string, campaignId?: string) => {
  await requireMember(communityId, userId);
  return (await db.listAssessments(communityId, campaignId)).map(presentAssessment);
};

export const updateAssessment = async (communityId: string, actorId: string, assessmentId: string, input: UpdateAssessmentInput) => {
  await requireAdmin(communityId, actorId);
  const assessment = await db.findAssessment(communityId, assessmentId);
  if (!assessment) throw new AppError("Assessment not found.", 404);
  if (assessment.status !== "DRAFT") throw new AppError("Only draft assessments can be edited.", 409);
  const updated = await db.updateDraftAssessment(communityId, assessmentId, {
    description: input.description ?? assessment.description,
    dueAt: new Date(input.dueAt),
  });
  if (!updated) throw new AppError("Assessment state changed; reload and try again.", 409);
  return presentAssessment(updated);
};

const localMonthKey = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit" }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Unable to resolve campaign timezone month.");
  return `${year}-${month}`;
};

const monthStartUtc = (periodKey: string, timezone: string) => {
  const [yearText, monthText] = periodKey.split("-");
  const target = Date.UTC(Number(yearText), Number(monthText) - 1, 1);
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(candidate));
    const partValue = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? Number.NaN);
    const year = partValue("year");
    const month = partValue("month");
    const day = partValue("day");
    const hour = partValue("hour");
    const minute = partValue("minute");
    const second = partValue("second");
    if (![year, month, day, hour, minute, second].every(Number.isFinite)) {
      throw new Error("Unable to resolve the community timezone month boundary.");
    }
    const represented = Date.UTC(year, month - 1, day, hour, minute, second);
    candidate += target - represented;
  }
  return new Date(candidate);
};

export const generateMonthlyDrafts = async (now = new Date()) => {
  const campaigns = await db.listAutomaticCampaigns();
  let created = 0;
  for (const campaign of campaigns) {
    const timezone = campaign.community.timezone;
    let periodKey: string;
    try { periodKey = localMonthKey(now, timezone); }
    catch { continue; }
    const boundary = monthStartUtc(periodKey, timezone);
    const eventsBeforeBoundary = campaign.events.filter((event) => event.createdAt <= boundary);
    const lastEventBeforeBoundary = eventsBeforeBoundary.at(-1);
    const inactiveAtBoundary = lastEventBeforeBoundary?.type === "PAUSED" || lastEventBeforeBoundary?.type === "ENDED" || lastEventBeforeBoundary?.type === "CANCELLED";
    if (campaign.createdAt >= boundary || inactiveAtBoundary || (campaign.endedAt !== null && campaign.endedAt <= boundary)) continue;
    if (!campaign.community.treasury) continue;
    const result = await db.createScheduledDraft({
      campaignId: campaign.id,
      communityId: campaign.communityId,
      periodKey,
      boundary,
      timezone,
    });
    if (result) created += 1;
  }
  return { scanned: campaigns.length, created };
};


const contributionFinancialStatus = (row: any, now = new Date()) => {
  if (!row.obligation) return "NOT_ISSUED";
  if (row.obligation.status === "CANCELLED") return "CANCELLED";
  const paid = row.obligation.allocations.reduce((sum: bigint, item: { amountMinor: bigint }) => sum + item.amountMinor, 0n);
  const amount = row.obligation.amountMinor as bigint;
  if (paid >= amount) return "PAID";
  if (paid > 0n) return "PARTIALLY_PAID";
  if (row.obligation.dueAt && row.obligation.dueAt < now) return "OVERDUE";
  return "UNPAID";
};

const presentContributionSnapshot = (row: any) => {
  const status = contributionFinancialStatus(row);
  const amount = row.obligation?.amountMinor ?? row.assessment.amountMinor;
  const allocated = row.obligation
    ? row.obligation.allocations.reduce((sum: bigint, item: { amountMinor: bigint }) => sum + item.amountMinor, 0n)
    : 0n;
  return {
    id: row.id,
    snapshotAt: row.snapshotAt,
    memberRole: row.memberRole,
    assessment: {
      id: row.assessment.id,
      campaignId: row.assessment.campaign.id,
      campaignName: row.assessment.campaign.name,
      periodKey: row.assessment.periodKey,
      description: row.assessment.description,
      status: row.assessment.status,
      dueAt: row.assessment.dueAt,
      currency: row.assessment.currency,
    },
    amountMinor: amount.toString(),
    allocatedMinor: allocated.toString(),
    outstandingMinor: (amount - allocated).toString(),
    financialStatus: status,
  };
};

export const listMyContributionHistory = async (communityId: string, userId: string, cursor?: string, limit = 25) => {
  const user = await db.findUserStatus(userId);
  if (!user || user.status !== "ACTIVE") throw new AppError("User not found.", 404);
  const rows = await db.listMyContributionSnapshots(communityId, userId, cursor, limit);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(presentContributionSnapshot);
  return { items, nextCursor: hasMore ? rows[limit - 1]?.id ?? null : null };
};

export const getAssessmentReport = async (communityId: string, userId: string, assessmentId: string) => {
  const access = await requireMember(communityId, userId);
  if (access.role !== "ADMIN" && access.role !== "TREASURER") {
    throw new AppError("Only the elected ADMIN or TREASURER can inspect contribution reports.", 403);
  }
  const assessment = await db.findAssessmentReport(communityId, assessmentId);
  if (!assessment) throw new AppError("Contribution assessment not found.", 404);

  const members = assessment.members;
  let assessed = 0n;
  let collected = 0n;
  let outstanding = 0n;
  const counts = { paid: 0, partiallyPaid: 0, unpaid: 0, overdue: 0, cancelled: 0, integrityErrors: 0 };
  for (const member of members) {
    if (!member.obligation) {
      counts.integrityErrors += assessment.status === "ISSUED" ? 1 : 0;
      continue;
    }
    const amount = member.obligation.amountMinor as bigint;
    const paid = member.obligation.allocations.reduce((sum: bigint, item: { amountMinor: bigint }) => sum + item.amountMinor, 0n);
    assessed += amount;
    collected += paid;
    outstanding += amount - paid;
    const status = contributionFinancialStatus(member);
    if (status === "PAID") counts.paid += 1;
    else if (status === "PARTIALLY_PAID") counts.partiallyPaid += 1;
    else if (status === "OVERDUE") counts.overdue += 1;
    else if (status === "UNPAID") counts.unpaid += 1;
    else if (status === "CANCELLED") counts.cancelled += 1;
  }

  return {
    assessment: {
      id: assessment.id,
      campaignId: assessment.campaign.id,
      campaignName: assessment.campaign.name,
      periodKey: assessment.periodKey,
      description: assessment.description,
      status: assessment.status,
      currency: assessment.currency,
      dueAt: assessment.dueAt,
      issuedAt: assessment.issuedAt,
      snapshotMemberCount: assessment._count.members,
    },
    totals: {
      assessedMinor: assessed.toString(),
      collectedMinor: collected.toString(),
      outstandingMinor: outstanding.toString(),
    },
    counts,
  };
};

export const listAssessmentReportMembers = async (communityId: string, userId: string, assessmentId: string, cursor?: string, limit = 25) => {
  const access = await requireMember(communityId, userId);
  if (access.role !== "ADMIN" && access.role !== "TREASURER") {
    throw new AppError("Only the elected ADMIN or TREASURER can inspect contribution reports.", 403);
  }
  const assessment = await db.findAssessment(communityId, assessmentId);
  if (!assessment) throw new AppError("Contribution assessment not found.", 404);
  const rows = await db.listAssessmentSnapshotMembers(assessmentId, cursor, limit);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row: any) => {
    const status = contributionFinancialStatus(row);
    const amount = row.obligation?.amountMinor ?? assessment.amountMinor;
    const allocated = row.obligation
      ? row.obligation.allocations.reduce((sum: bigint, item: { amountMinor: bigint }) => sum + item.amountMinor, 0n)
      : 0n;
    return {
      id: row.id,
      memberId: row.memberId,
      firstName: row.memberFirstName,
      lastName: row.memberLastName,
      email: row.memberEmail,
      roleAtIssuance: row.memberRole,
      joinedAt: row.memberJoinedAt,
      snapshotAt: row.snapshotAt,
      amountMinor: row.obligation ? amount.toString() : null,
      allocatedMinor: allocated.toString(),
      outstandingMinor: row.obligation ? (amount - allocated).toString() : null,
      financialStatus: status,
    };
  });
  return { items, nextCursor: hasMore ? rows[limit - 1]?.id ?? null : null };
};
