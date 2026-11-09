import { prisma, type Prisma } from "@playgeng/database";

const communityInclude = {
  owner: { select: { id: true, email: true, firstName: true, lastName: true } },
  members: { select: { id: true, userId: true, role: true, joinedAt: true } },
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

export const archiveCommunity = (id: string) =>
  prisma.community.update({ where: { id }, data: { status: "ARCHIVED" } });

export const findMembership = (communityId: string, userId: string) =>
  prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
  });

export const findUserByEmail = (email: string) =>
  prisma.user.findUnique({ where: { email }, select: { id: true, email: true, firstName: true, lastName: true, status: true } });

export const addMember = (communityId: string, userId: string, role: Prisma.CommunityMemberRole) =>
  prisma.communityMember.create({ data: { communityId, userId, role } });

export const updateMemberRole = (communityId: string, userId: string, role: Prisma.CommunityMemberRole) =>
  prisma.communityMember.update({ where: { communityId_userId: { communityId, userId } }, data: { role } });

export const removeMember = (communityId: string, userId: string) =>
  prisma.communityMember.delete({ where: { communityId_userId: { communityId, userId } } });
