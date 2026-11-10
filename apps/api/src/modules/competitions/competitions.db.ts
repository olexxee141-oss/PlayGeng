import { prisma, type CompetitionInvitationStatus, type Prisma, type Sport } from "@playgeng/database";

export const findMembership = (communityId: string, userId: string) =>
  prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } } });

export const findCommunity = (communityId: string) =>
  prisma.community.findUnique({ where: { id: communityId }, select: { id: true, status: true } });

export const findCommunitySport = (communityId: string, sport: Sport) =>
  prisma.communitySport.findUnique({ where: { communityId_sport: { communityId, sport } } });

export const createCompetition = (data: Prisma.CompetitionUncheckedCreateInput) =>
  prisma.competition.create({
    data,
    include: { sport: { select: { sport: true } }, _count: { select: { entries: true } } },
  });

export const listCompetitions = (communityId: string) =>
  prisma.competition.findMany({
    where: { communityId },
    include: { sport: { select: { sport: true } }, _count: { select: { entries: true } } },
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
  });

export const findCompetition = (communityId: string, competitionId: string) =>
  prisma.competition.findFirst({
    where: { id: competitionId, communityId },
    include: { sport: { select: { sport: true } }, _count: { select: { entries: true } } },
  });

export const findCommunityMember = (communityId: string, userId: string) =>
  prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    include: { user: { select: { id: true, firstName: true, lastName: true, status: true } } },
  });

export const findTeam = (communityId: string, teamId: string) =>
  prisma.team.findFirst({
    where: { id: teamId, communityId },
    select: { id: true, name: true, status: true, communitySportId: true },
  });

export const findTeamMembership = (teamId: string, userId: string) =>
  prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } }, select: { role: true } });

export const listEntries = (communityId: string, competitionId: string) =>
  prisma.competitionEntry.findMany({
    where: { communityId, competitionId, status: { in: ["PENDING", "APPROVED"] } },
    include: {
      team: { select: { id: true, name: true } },
      player: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { registeredAt: "asc" },
  });

export const findEntry = (communityId: string, competitionId: string, entryId: string) =>
  prisma.competitionEntry.findFirst({ where: { id: entryId, communityId, competitionId } });

const isSerializationConflict = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "P2034") return true;
  if ("cause" in error) {
    const cause = error.cause;
    if (typeof cause === "object" && cause !== null && "originalCode" in cause && cause.originalCode === "40001") return true;
    return isSerializationConflict(cause);
  }
  return false;
};

export const withCompetitionRegistrationTransaction = async <T>(
  competitionId: string,
  communityId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) => prisma.$transaction(async (tx) => {
  // Serialize capacity checks for this competition. Under READ COMMITTED, the
  // count below sees registrations committed by the transaction that held the
  // lock immediately before this one.
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "competitions"
    WHERE "id" = ${competitionId} AND "communityId" = ${communityId}
    FOR UPDATE
  `;
  if (rows.length !== 1) throw new Error("Competition registration lock could not be acquired.");
  return work(tx);
}, { isolationLevel: "ReadCommitted" });

export const withSerializableTransaction = async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
  throw new Error("Serializable transaction retry limit reached.");
};


export const findTeamWithCaptain = (communityId: string, teamId: string) =>
  prisma.team.findFirst({
    where: { id: teamId, communityId },
    select: {
      id: true,
      name: true,
      status: true,
      communitySportId: true,
      members: { where: { role: "CAPTAIN" }, select: { userId: true, user: { select: { status: true } } }, take: 1 },
    },
  });

export const listInvitations = (communityId: string, competitionId: string, invitedUserId?: string) =>
  prisma.competitionInvitation.findMany({
    where: { communityId, competitionId, ...(invitedUserId ? { invitedUserId } : {}) },
    include: {
      team: { select: { id: true, name: true } },
      player: { select: { id: true, firstName: true, lastName: true } },
      invitedUser: { select: { id: true, firstName: true, lastName: true } },
      invitedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

export const findInvitation = (communityId: string, competitionId: string, invitationId: string) =>
  prisma.competitionInvitation.findFirst({
    where: { id: invitationId, communityId, competitionId },
    include: { team: { select: { id: true, name: true } }, player: { select: { id: true, firstName: true, lastName: true } } },
  });

export const updateInvitationStatus = (invitationId: string, currentStatus: CompetitionInvitationStatus, nextStatus: CompetitionInvitationStatus) =>
  prisma.competitionInvitation.updateMany({
    where: { id: invitationId, status: currentStatus },
    data: { status: nextStatus },
  });

export const expirePendingInvitations = (communityId: string, competitionId: string, invitedUserId?: string) =>
  prisma.competitionInvitation.updateMany({
    where: {
      communityId,
      competitionId,
      status: "PENDING",
      expiresAt: { lte: new Date() },
      ...(invitedUserId ? { invitedUserId } : {}),
    },
    data: { status: "EXPIRED" },
  });
