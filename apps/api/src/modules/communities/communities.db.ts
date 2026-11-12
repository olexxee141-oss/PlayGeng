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
  const rows = await tx.$queryRaw<Array<{ id: string; ownerId: string }>>`
    UPDATE "communities" SET "updatedAt" = "updatedAt"
    WHERE "id" = ${communityId} AND "status" = 'ACTIVE'
    RETURNING "id", "ownerId"
  `;
  return rows[0] ?? null;
};

const canManageMembersInTransaction = async (
  tx: Prisma.TransactionClient,
  communityId: string,
  actorId: string,
  ownerId: string,
) => {
  if (actorId === ownerId) return true;
  const actor = await tx.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId: actorId } },
    select: { role: true },
  });
  return actor?.role === "ADMIN";
};

const isSerializationConflict = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "P2034") return true;
  if ("meta" in error && typeof error.meta === "object" && error.meta !== null &&
    "code" in error.meta && String(error.meta.code) === "40001") return true;
  if ("message" in error && typeof error.message === "string" &&
    /could not serialize access|serialization failure|code:\s*\x6040001\x60/i.test(error.message)) return true;
  if ("cause" in error) return isSerializationConflict(error.cause);
  return false;
};

const withMembershipBoundaryTransaction = async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
  throw new Error("Membership boundary transaction retry limit reached.");
};

export const addMember = (communityId: string, actorId: string, userId: string, role: CommunityMemberRole) =>
  withMembershipBoundaryTransaction(async (tx) => {
    const community = await lockMembershipBoundary(tx, communityId);
    if (!community) return { kind: "COMMUNITY_NOT_ACTIVE" as const };
    if (!await canManageMembersInTransaction(tx, communityId, actorId, community.ownerId)) {
      return { kind: "FORBIDDEN" as const };
    }
    const member = await tx.communityMember.create({ data: { communityId, userId, role } });
    return { kind: "ADDED" as const, member };
  });

export const removeMember = (communityId: string, actorId: string, userId: string) =>
  withMembershipBoundaryTransaction(async (tx) => {
    const community = await lockMembershipBoundary(tx, communityId);
    if (!community) return { kind: "COMMUNITY_NOT_ACTIVE" as const };
    if (!await canManageMembersInTransaction(tx, communityId, actorId, community.ownerId)) {
      return { kind: "FORBIDDEN" as const };
    }
    const target = await tx.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
      select: { role: true },
    });
    if (!target) return { kind: "NOT_FOUND" as const };
    if (target.role === "CREATOR") return { kind: "CREATOR" as const };
    if (target.role !== "MEMBER") return { kind: "OFFICE_HOLDER" as const };
    await tx.communityMember.delete({ where: { communityId_userId: { communityId, userId } } });
    return { kind: "REMOVED" as const };
  });
