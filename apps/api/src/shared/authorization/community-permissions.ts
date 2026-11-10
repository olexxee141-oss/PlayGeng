import { prisma } from "@playgeng/database";
import { AppError } from "../errors/app-error.js";
import { roleHasCommunityPermission, type CommunityPermission } from "./community-role-policy.js";

export { roleHasCommunityPermission } from "./community-role-policy.js";
export type { CommunityPermission } from "./community-role-policy.js";

export const getCommunityAccess = (communityId: string, userId: string) =>
  prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    include: { community: { select: { ownerId: true, status: true } } },
  });

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
