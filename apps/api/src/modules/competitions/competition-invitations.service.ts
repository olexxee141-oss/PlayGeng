import { AppError } from "../../shared/errors/app-error.js";
import * as db from "./competitions.db.js";
import type { CreateCompetitionInvitationInput } from "./competition-invitations.validator.js";

const managerRoles = new Set(["OWNER", "ADMIN", "ORGANIZER"]);

const requireMembership = async (communityId: string, userId: string) => {
  const membership = await db.findMembership(communityId, userId);
  if (!membership) throw new AppError("Community not found.", 404);
  return membership;
};

const requireManager = async (communityId: string, userId: string) => {
  const membership = await requireMembership(communityId, userId);
  if (!managerRoles.has(membership.role)) throw new AppError("You do not have permission to manage competition invitations.", 403);
};

const requireActiveCommunity = async (communityId: string) => {
  const community = await db.findCommunity(communityId);
  if (!community || community.status !== "ACTIVE") throw new AppError("Community not found.", 404);
};

const requireInviteCompetition = async (communityId: string, competitionId: string) => {
  const competition = await db.findCompetition(communityId, competitionId);
  if (!competition) throw new AppError("Competition not found.", 404);
  if (competition.registrationMode !== "INVITE_ONLY") throw new AppError("Invitations are only available for invite-only competitions.", 409);
  if (competition.status !== "REGISTRATION_OPEN") throw new AppError("This competition is not accepting invitations.", 409);
  const now = new Date();
  if (competition.registrationOpensAt && competition.registrationOpensAt > now) throw new AppError("Registration has not opened yet.", 409);
  if (competition.registrationClosesAt && competition.registrationClosesAt <= now) throw new AppError("Registration has closed.", 409);
  return competition;
};

const normalizeExpiry = (expiresAt?: Date) => {
  const now = new Date();
  const expiry = expiresAt ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const maxExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (expiry <= now || expiry > maxExpiry) throw new AppError("Invitation expiry must be within the next 30 days.", 400);
  return expiry;
};

export const createInvitation = async (communityId: string, competitionId: string, actorId: string, input: CreateCompetitionInvitationInput) => {
  await requireManager(communityId, actorId);
  await requireActiveCommunity(communityId);
  const competition = await requireInviteCompetition(communityId, competitionId);
  const expiresAt = normalizeExpiry(input.expiresAt);

  let teamId: string | null = null;
  let playerUserId: string | null = null;
  let invitedUserId: string;

  if (competition.participantType === "TEAM") {
    if (!input.teamId || input.playerUserId) throw new AppError("This competition requires a team invitation.", 400);
    const team = await db.findTeamWithCaptain(communityId, input.teamId);
    if (!team || team.status !== "ACTIVE" || team.communitySportId !== competition.communitySportId) {
      throw new AppError("An active team registered for this competition's sport is required.", 409);
    }
    if (!team.members[0]) throw new AppError("The team must have a captain before it can be invited.", 409);
    teamId = team.id;
    invitedUserId = team.members[0].userId;
  } else {
    if (!input.playerUserId || input.teamId) throw new AppError("This competition requires an individual player invitation.", 400);
    const member = await db.findCommunityMember(communityId, input.playerUserId);
    if (!member || member.user.status !== "ACTIVE") throw new AppError("An active community member is required.", 409);
    playerUserId = member.user.id;
    invitedUserId = member.user.id;
  }

  if (await db.findActiveEntry(competitionId, teamId, playerUserId)) {
    throw new AppError("This participant is already registered for the competition.", 409);
  }

  try {
    return await db.createInvitation({
      competitionId,
      communityId,
      participantType: competition.participantType,
      teamId,
      playerUserId,
      invitedUserId,
      invitedById: actorId,
      expiresAt,
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new AppError("A pending invitation already exists for this participant.", 409);
    }
    throw error;
  }
};

export const listInvitations = async (communityId: string, competitionId: string, actorId: string) => {
  const membership = await requireMembership(communityId, actorId);
  await requireActiveCommunity(communityId);
  await requireInviteCompetition(communityId, competitionId);
  const isManager = managerRoles.has(membership.role);
  return db.listInvitations(communityId, competitionId, isManager ? undefined : actorId);
};

export const acceptInvitation = async (communityId: string, competitionId: string, invitationId: string, actorId: string) => {
  await requireMembership(communityId, actorId);
  await requireActiveCommunity(communityId);
  const invitation = await db.findInvitation(communityId, competitionId, invitationId);
  if (!invitation) throw new AppError("Competition invitation not found.", 404);
  if (invitation.invitedUserId !== actorId) throw new AppError("This invitation was not issued to you.", 403);
  if (invitation.status !== "PENDING") throw new AppError("This invitation is no longer pending.", 409);
  if (invitation.expiresAt <= new Date()) {
    await db.updateInvitationStatus(invitationId, "PENDING", "EXPIRED");
    throw new AppError("This invitation has expired.", 410);
  }
  const competition = await requireInviteCompetition(communityId, competitionId);

  let participantNameSnapshot: string;
  if (invitation.participantType === "PLAYER") {
    const member = await db.findCommunityMember(communityId, actorId);
    if (!member || member.user.status !== "ACTIVE" || invitation.playerUserId !== actorId) {
      throw new AppError("An active community membership is required to accept this invitation.", 409);
    }
    participantNameSnapshot = `${member.user.firstName} ${member.user.lastName}`.trim();
  } else {
    if (!invitation.teamId) throw new AppError("The invitation has no team participant.", 409);
    const team = await db.findTeamWithCaptain(communityId, invitation.teamId);
    if (!team || team.status !== "ACTIVE" || team.communitySportId !== competition.communitySportId) {
      throw new AppError("The invited team is no longer eligible.", 409);
    }
    if (team.members[0]?.userId !== actorId) throw new AppError("Only the current team captain can accept this invitation.", 403);
    participantNameSnapshot = team.name;
  }

  try {
    return await db.withSerializableTransaction(async (tx) => {
      const currentInvitation = await tx.competitionInvitation.findFirst({
        where: { id: invitationId, competitionId, communityId, invitedUserId: actorId, status: "PENDING", expiresAt: { gt: new Date() } },
      });
      if (!currentInvitation) throw new AppError("This invitation is no longer pending or has expired.", 409);
      const currentCompetition = await tx.competition.findFirst({ where: { id: competitionId, communityId } });
      if (!currentCompetition || currentCompetition.status !== "REGISTRATION_OPEN" || currentCompetition.registrationMode !== "INVITE_ONLY") {
        throw new AppError("This competition is no longer accepting invitations.", 409);
      }
      const count = await tx.competitionEntry.count({ where: { competitionId, status: { in: ["PENDING", "APPROVED"] } } });
      if (currentCompetition.maxEntries !== null && count >= currentCompetition.maxEntries) {
        throw new AppError("This competition has reached its registration capacity.", 409);
      }
      const entry = await tx.competitionEntry.create({
        data: {
          competitionId,
          communityId,
          participantType: invitation.participantType,
          teamId: invitation.teamId,
          playerUserId: invitation.playerUserId,
          status: "APPROVED",
          participantNameSnapshot,
        },
      });
      const updated = await tx.competitionInvitation.updateMany({
        where: { id: invitationId, status: "PENDING" },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      if (updated.count !== 1) throw new AppError("This invitation was accepted concurrently.", 409);
      return entry;
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new AppError("This participant already has an active competition entry.", 409);
    }
    throw error;
  }
};

export const declineInvitation = async (communityId: string, competitionId: string, invitationId: string, actorId: string) => {
  await requireMembership(communityId, actorId);
  await requireActiveCommunity(communityId);
  const invitation = await db.findInvitation(communityId, competitionId, invitationId);
  if (!invitation) throw new AppError("Competition invitation not found.", 404);
  if (invitation.invitedUserId !== actorId) throw new AppError("This invitation was not issued to you.", 403);
  if (invitation.status !== "PENDING") throw new AppError("This invitation is no longer pending.", 409);
  const status = invitation.expiresAt <= new Date() ? "EXPIRED" : "DECLINED";
  const updated = await db.updateInvitationStatus(invitationId, "PENDING", status);
  if (updated.count !== 1) throw new AppError("This invitation changed concurrently.", 409);
};
