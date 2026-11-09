import { prisma, type Prisma, type Sport, type TeamMemberRole } from "@playgeng/database";

const teamInclude = {
  sport: { select: { id: true, sport: true, isPrimary: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  members: {
    orderBy: { joinedAt: "asc" as const },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  },
  _count: { select: { members: true } },
} satisfies Prisma.TeamInclude;

export const findMembership = (communityId: string, userId: string) =>
  prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } } });

export const findCommunity = (communityId: string) =>
  prisma.community.findUnique({ where: { id: communityId }, select: { id: true, status: true } });

export const listSports = (communityId: string) =>
  prisma.communitySport.findMany({ where: { communityId }, orderBy: [{ isPrimary: "desc" }, { sport: "asc" }] });

export const findSport = (communityId: string, sport: Sport) =>
  prisma.communitySport.findUnique({ where: { communityId_sport: { communityId, sport } } });

export const enableSport = (communityId: string, sport: Sport) =>
  prisma.communitySport.upsert({
    where: { communityId_sport: { communityId, sport } },
    create: { communityId, sport, isPrimary: false },
    update: {},
  });

export const countTeamsForSport = (communitySportId: string) =>
  prisma.team.count({ where: { communitySportId } });

export const removeSport = (communitySportId: string) =>
  prisma.communitySport.delete({ where: { id: communitySportId } });

export const createTeam = (data: Prisma.TeamUncheckedCreateInput) =>
  prisma.team.create({ data, include: teamInclude });

export const listTeams = (communityId: string) =>
  prisma.team.findMany({
    where: { communityId, status: "ACTIVE" },
    include: { sport: { select: { id: true, sport: true, isPrimary: true } }, createdBy: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
  });

export const findTeam = (communityId: string, teamId: string) =>
  prisma.team.findFirst({ where: { id: teamId, communityId }, include: teamInclude });

export const findTeamByName = (communityId: string, name: string) =>
  prisma.team.findFirst({ where: { communityId, name: { equals: name, mode: "insensitive" } }, select: { id: true } });

export const updateTeam = (teamId: string, data: Prisma.TeamUpdateInput) =>
  prisma.team.update({ where: { id: teamId }, data, include: teamInclude });

export const archiveTeam = (teamId: string) =>
  prisma.team.update({ where: { id: teamId }, data: { status: "ARCHIVED" } });

export const findCommunityMember = (communityId: string, userId: string) =>
  prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    include: { user: { select: { id: true, status: true } } },
  });

export const addTeamMember = (teamId: string, communityId: string, userId: string, role: TeamMemberRole) =>
  prisma.$transaction(async (tx) => {
    if (role === "CAPTAIN") {
      await tx.teamMember.updateMany({ where: { teamId, role: "CAPTAIN" }, data: { role: "PLAYER", captainKey: null } });
    }
    return tx.teamMember.create({
      data: { teamId, communityId, userId, role, captainKey: role === "CAPTAIN" ? "CAPTAIN" : null },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  });

export const findTeamMember = (teamId: string, userId: string) =>
  prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });

export const updateTeamMemberRole = (teamId: string, userId: string, role: TeamMemberRole) =>
  prisma.$transaction(async (tx) => {
    if (role === "CAPTAIN") {
      await tx.teamMember.updateMany({ where: { teamId, role: "CAPTAIN", userId: { not: userId } }, data: { role: "PLAYER", captainKey: null } });
    }
    return tx.teamMember.update({
      where: { teamId_userId: { teamId, userId } },
      data: { role, captainKey: role === "CAPTAIN" ? "CAPTAIN" : null },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  });

export const removeTeamMember = (teamId: string, userId: string) =>
  prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
