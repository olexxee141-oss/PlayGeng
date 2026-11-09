import { prisma, type Prisma } from "@playgeng/database";

const matchInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  participants: {
    orderBy: { joinedAt: "asc" as const },
    select: {
      id: true,
      userId: true,
      status: true,
      joinedAt: true,
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  _count: { select: { participants: true } },
} satisfies Prisma.MatchInclude;

export const findMembership = (communityId: string, userId: string) =>
  prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } } });

export const findCommunity = (communityId: string) =>
  prisma.community.findUnique({ where: { id: communityId }, select: { id: true, sport: true, status: true } });

export const createMatch = (data: Prisma.MatchUncheckedCreateInput) =>
  prisma.match.create({ data, include: matchInclude });

export const listMatches = (communityId: string) =>
  prisma.match.findMany({ where: { communityId }, include: matchInclude, orderBy: { startsAt: "asc" } });

export const findMatch = (communityId: string, matchId: string) =>
  prisma.match.findFirst({ where: { id: matchId, communityId }, include: matchInclude });

export const updateMatch = (matchId: string, data: Prisma.MatchUpdateInput) =>
  prisma.match.update({ where: { id: matchId }, data, include: matchInclude });

export const withSerializableTransaction = <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
  prisma.$transaction(work, { isolationLevel: "Serializable" });
