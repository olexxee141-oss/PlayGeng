import { prisma } from "@playgeng/database";
import { AppError } from "../errors/app-error.js";

export type CommunityPermission =
  | "MANAGE_COMMUNITY"
  | "MANAGE_MEMBERS"
  | "ARCHIVE_COMMUNITY"
  | "MANAGE_MATCHES"
  | "MANAGE_TEAMS"
  | "MANAGE_COMPETITIONS";

const rolePermissions: Record<CommunityPermission, readonly string[]> = {
  MANAGE_COMMUNITY: ["ADMIN"],
  MANAGE_MEMBERS: ["ADMIN"],
  ARCHIVE_COMMUNITY: [],
  MANAGE_MATCHES: ["ADMIN", "ORGANIZER"],
  MANAGE_TEAMS: ["ADMIN", "ORGANIZER"],
  MANAGE_COMPETITIONS: ["ADMIN", "ORGANIZER"],
};

export const getCommunityAccess = (communityId: string, userId: string) =>
  prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    include: { community: { select: { ownerId: true, status: true } } },
  });

export const roleHasCommunityPermission = (role: string, permission: CommunityPermission): boolean =>
  rolePermissions[permission].includes(role);

export const hasCommunityPermission = async (
  communityId: string,
  userId: string,
  permission: CommunityPermission,
): Promise<boolean> => {
  const access = await getCommunityAccess(communityId, userId);
  if (!access) return false;
  if (access.community.ownerId === userId) return true;
  return roleHasCommunityPermission(access.role, permission);
};

export const requireCommunityPermission = async (
  communityId: string,
  userId: string,
  permission: CommunityPermission,
  message = "You do not have permission to perform this action.",
) => {
  const access = await getCommunityAccess(communityId, userId);
  if (!access) throw new AppError("Community not found.", 404);
  const isCreator = access.community.ownerId === userId;
  const allowed = isCreator || roleHasCommunityPermission(access.role, permission);
  if (!allowed) throw new AppError(message, 403);
  return access;
};
