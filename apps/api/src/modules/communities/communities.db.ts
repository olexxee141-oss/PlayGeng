import { prisma, type Prisma, type CommunityMemberRole } from "@playgeng/database";

const communityInclude = {
  owner: { select: { id: true, email: true, firstName: true, lastName: true } },
  members: { select: { id: true, userId: true, role: true, joinedAt: true } },
  sports: { orderBy: [{ isPrimary: "desc" as const }, { sport: "asc" as const }] },
} satisfies Prisma.CommunityInclude;

export const createCommunity = (data: Prisma.CommunityCreateInput) =>
  prisma.community.create({ data, include: communityInclude });

export const findCommunityById = (id: string) =>
  prisma.community.findUnique({ where: { id }, include: communityInclude });

export const findCommunityBySlug = (slug: string) =>
  prisma.community.findUnique({ where: { slug } });

export const listCommunitiesForUser = (userId: string) =>
  prisma.community.findMany({
    where: { status: "ACTIVE", members: { some: { userId } } },
    include: { members: { where: { userId }, select: { role: true, joinedAt: true } } },
    orderBy: { createdAt: "desc" },
  });

export const updateCommunity = (id: string, data: Prisma.CommunityUpdateInput) =>
  prisma.community.update({ where: { id }, data, include: communityInclude });

export const updateCommunityPrimarySport = (id: string, data: Prisma.CommunityUpdateInput, sport: import("@playgeng/database").Sport) =>
  prisma.$transaction(async (tx) => {
    const existing = await tx.communitySport.findUnique({ where: { communityId_sport: { communityId: id, sport } } });
    await tx.communitySport.updateMany({ where: { communityId: id, isPrimary: true }, data: { isPrimary: false } });
    if (existing) {
      await tx.communitySport.update({ where: { id: existing.id }, data: { isPrimary: true } });
    } else {
      await tx.communitySport.create({ data: { communityId: id, sport, isPrimary: true } });
    }
    return tx.community.update({ where: { id }, data, include: communityInclude });
  });

export const archiveCommunity = (id: string) =>
  prisma.community.update({ where: { id }, data: { status: "ARCHIVED" } });

export const findMembership = (communityId: string, userId: string) =>
  prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
  });

export const findUserByEmail = (email: string) =>
  prisma.user.findUnique({ where: { email }, select: { id: true, email: true, firstName: true, lastName: true, status: true } });

const lockMembershipBoundary = async (tx: Prisma.TransactionClient, communityId: string) => {
  await tx.$queryRaw<Array<{ id: string }>>`
    UPDATE "communities" SET "updatedAt" = "updatedAt"
    WHERE "id" = ${communityId}
    RETURNING "id"
  `;
};

export const addMember = (communityId: string, userId: string, role: CommunityMemberRole) =>
  prisma.$transaction(async (tx) => {
    await lockMembershipBoundary(tx, communityId);
    return tx.communityMember.create({ data: { communityId, userId, role } });
  }, { isolationLevel: "Serializable" });

export const updateMemberRole = (communityId: string, userId: string, role: CommunityMemberRole) =>
  prisma.$transaction(async (tx) => {
    await lockMembershipBoundary(tx, communityId);
    return tx.communityMember.update({ where: { communityId_userId: { communityId, userId } }, data: { role } });
  }, { isolationLevel: "Serializable" });

export const removeMember = (communityId: string, userId: string) =>
  prisma.$transaction(async (tx) => {
    await lockMembershipBoundary(tx, communityId);
    return tx.communityMember.delete({ where: { communityId_userId: { communityId, userId } } });
  }, { isolationLevel: "Serializable" });
