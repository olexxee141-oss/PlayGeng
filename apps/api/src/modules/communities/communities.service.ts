import type { CommunityMemberRole } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import * as db from "./communities.db.js";
import { requireCommunityPermission } from "../../shared/authorization/community-permissions.js";
import type { AddMemberInput, CreateCommunityInput, UpdateCommunityInput } from "./communities.validator.js";

export const createCommunity = async (ownerId: string, input: CreateCommunityInput) => {
  const existing = await db.findCommunityBySlug(input.slug);
  if (existing) throw new AppError("That community slug is already in use.", 409);

  return db.createCommunity({
    name: input.name,
    slug: input.slug,
    ...(input.description ? { description: input.description } : {}),
    sport: input.sport,
    owner: { connect: { id: ownerId } },
    members: { create: { userId: ownerId, role: "CREATOR" } },
    sports: { create: { sport: input.sport, isPrimary: true } },
  });
};

export const listMyCommunities = (userId: string) => db.listCommunitiesForUser(userId);

export const getCommunity = async (communityId: string, userId: string) => {
  const membership = await db.findMembership(communityId, userId);
  if (!membership) throw new AppError("Community not found.", 404);
  const community = await db.findCommunityById(communityId);
  if (!community || community.status !== "ACTIVE") throw new AppError("Community not found.", 404);
  return community;
};

export const updateCommunity = async (communityId: string, userId: string, input: UpdateCommunityInput) => {
  await requireCommunityPermission(communityId, userId, "MANAGE_COMMUNITY", "You do not have permission to manage this community.");
  const data = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.sport !== undefined ? { sport: input.sport } : {}),
  };
  if (input.sport !== undefined) return db.updateCommunityPrimarySport(communityId, data, input.sport as import("@playgeng/database").Sport);
  return db.updateCommunity(communityId, data);
};

export const archiveCommunity = async (communityId: string, userId: string) => {
  await requireCommunityPermission(communityId, userId, "ARCHIVE_COMMUNITY", "Only the community creator can archive this community.");
  await db.archiveCommunity(communityId);
};

export const addMember = async (communityId: string, actorId: string, input: AddMemberInput) => {
  await requirePrivilegedMembership(communityId, actorId);
  const community = await db.findCommunityById(communityId);
  if (!community || community.status !== "ACTIVE") throw new AppError("Community not found.", 404);

  const user = await db.findUserByEmail(input.email.toLowerCase());
  if (!user || user.status !== "ACTIVE") throw new AppError("No active PlayGeng user exists with that email.", 404);

  const existing = await db.findMembership(communityId, user.id);
  if (existing) throw new AppError("This user is already a community member.", 409);

  return db.addMember(communityId, user.id, "MEMBER");
};

export const updateMemberRole = async (communityId: string, actorId: string, memberId: string, role: CommunityMemberRole) => {
  await requireCommunityPermission(communityId, actorId, "MANAGE_MEMBERS");
  const target = await db.findMembership(communityId, memberId);
  if (!target) throw new AppError("Community member not found.", 404);
  if (target.role === "CREATOR") throw new AppError("The community creator role cannot be changed.", 400);
  if (role !== target.role) {
    throw new AppError("Community roles are assigned through governance elections. Direct role changes are disabled.", 409);
  }
  return target;
};

export const removeMember = async (communityId: string, actorId: string, memberId: string) => {
  const actor = await requireCommunityPermission(communityId, actorId, "MANAGE_MEMBERS");
  const target = await db.findMembership(communityId, memberId);
  if (!target) throw new AppError("Community member not found.", 404);
  if (target.userId === actor.community.ownerId) throw new AppError("The community creator cannot be removed.", 400);
  if (actor.role === "ADMIN" && target.role !== "MEMBER") throw new AppError("Admins cannot remove privileged members.", 403);
  await db.removeMember(communityId, memberId);
};

const requirePrivilegedMembership = async (communityId: string, userId: string) =>
  requireCommunityPermission(communityId, userId, "MANAGE_COMMUNITY", "You do not have permission to manage this community.");
