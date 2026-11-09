import { AppError } from "../../shared/errors/app-error.js";
import type { TeamMemberRole, Sport } from "@playgeng/database";
import * as db from "./teams.db.js";
import type { CreateTeamInput, SportInput, TeamMemberInput, UpdateTeamInput } from "./teams.validator.js";

const managerRoles = new Set(["OWNER", "ADMIN", "ORGANIZER"]);

const requireMembership = async (communityId: string, userId: string) => {
  const membership = await db.findMembership(communityId, userId);
  if (!membership) throw new AppError("Community not found.", 404);
  return membership;
};

const requireManager = async (communityId: string, userId: string) => {
  const membership = await requireMembership(communityId, userId);
  if (!managerRoles.has(membership.role)) throw new AppError("You do not have permission to manage community teams.", 403);
};

const requireActiveCommunity = async (communityId: string) => {
  const community = await db.findCommunity(communityId);
  if (!community || community.status !== "ACTIVE") throw new AppError("Community not found.", 404);
};

export const listSports = async (communityId: string, userId: string) => {
  await requireMembership(communityId, userId);
  return db.listSports(communityId);
};

export const enableSport = async (communityId: string, userId: string, sport: SportInput) => {
  await requireManager(communityId, userId);
  await requireActiveCommunity(communityId);
  return db.enableSport(communityId, sport as Sport);
};

export const removeSport = async (communityId: string, userId: string, sport: SportInput) => {
  await requireManager(communityId, userId);
  const community = await db.findCommunity(communityId);
  if (!community || community.status !== "ACTIVE") throw new AppError("Community not found.", 404);
  const communitySport = await db.findSport(communityId, sport as Sport);
  if (!communitySport) throw new AppError("This sport is not enabled for the community.", 404);
  if (communitySport.isPrimary) throw new AppError("The primary community sport cannot be removed. Change the primary sport first.", 409);
  if (await db.countTeamsForSport(communitySport.id)) throw new AppError("This sport cannot be removed while active teams use it.", 409);
  await db.removeSport(communitySport.id);
};

export const listTeams = async (communityId: string, userId: string) => {
  await requireMembership(communityId, userId);
  await requireActiveCommunity(communityId);
  return db.listTeams(communityId);
};

export const getTeam = async (communityId: string, teamId: string, userId: string) => {
  await requireMembership(communityId, userId);
  await requireActiveCommunity(communityId);
  const team = await db.findTeam(communityId, teamId);
  if (!team || team.status !== "ACTIVE") throw new AppError("Team not found.", 404);
  return team;
};

export const createTeam = async (communityId: string, userId: string, input: CreateTeamInput) => {
  await requireManager(communityId, userId);
  await requireActiveCommunity(communityId);
  const sport = await db.findSport(communityId, input.sport as Sport);
  if (!sport) throw new AppError("Enable this sport for the community before creating a team.", 409);
  if (await db.findTeamByName(communityId, input.name)) throw new AppError("A team with this name already exists in the community.", 409);
  return db.createTeam({
    communityId,
    communitySportId: sport.id,
    createdById: userId,
    name: input.name,
    ...(input.shortName !== undefined ? { shortName: input.shortName } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
  });
};

export const updateTeam = async (communityId: string, teamId: string, userId: string, input: UpdateTeamInput) => {
  await requireManager(communityId, userId);
  await requireActiveCommunity(communityId);
  const team = await db.findTeam(communityId, teamId);
  if (!team || team.status !== "ACTIVE") throw new AppError("Team not found.", 404);
  if (input.name && input.name.toLowerCase() !== team.name.toLowerCase() && await db.findTeamByName(communityId, input.name)) {
    throw new AppError("A team with this name already exists in the community.", 409);
  }
  return db.updateTeam(teamId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.shortName !== undefined ? { shortName: input.shortName } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
  });
};

export const archiveTeam = async (communityId: string, teamId: string, userId: string) => {
  await requireManager(communityId, userId);
  await requireActiveCommunity(communityId);
  const team = await db.findTeam(communityId, teamId);
  if (!team || team.status !== "ACTIVE") throw new AppError("Team not found.", 404);
  await db.archiveTeam(teamId);
};

export const addTeamMember = async (communityId: string, teamId: string, actorId: string, input: TeamMemberInput) => {
  await requireManager(communityId, actorId);
  await requireActiveCommunity(communityId);
  const team = await db.findTeam(communityId, teamId);
  if (!team || team.status !== "ACTIVE") throw new AppError("Team not found.", 404);
  const member = await db.findCommunityMember(communityId, input.userId);
  if (!member || member.user.status !== "ACTIVE") throw new AppError("An active community member is required before adding someone to a team.", 409);
  if (await db.findTeamMember(teamId, input.userId)) throw new AppError("This member is already on the team.", 409);
  return db.addTeamMember(teamId, communityId, input.userId, input.role as TeamMemberRole);
};

export const updateTeamMemberRole = async (communityId: string, teamId: string, actorId: string, userId: string, role: TeamMemberRole) => {
  await requireManager(communityId, actorId);
  await requireActiveCommunity(communityId);
  const team = await db.findTeam(communityId, teamId);
  if (!team || team.status !== "ACTIVE") throw new AppError("Team not found.", 404);
  if (!await db.findTeamMember(teamId, userId)) throw new AppError("Team member not found.", 404);
  return db.updateTeamMemberRole(teamId, userId, role);
};

export const removeTeamMember = async (communityId: string, teamId: string, actorId: string, userId: string) => {
  await requireManager(communityId, actorId);
  await requireActiveCommunity(communityId);
  const team = await db.findTeam(communityId, teamId);
  if (!team || team.status !== "ACTIVE") throw new AppError("Team not found.", 404);
  if (!await db.findTeamMember(teamId, userId)) throw new AppError("Team member not found.", 404);
  await db.removeTeamMember(teamId, userId);
};
