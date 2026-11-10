import { getSportCapability } from "@playgeng/shared";
import type { CompetitionParticipantType, CompetitionStatus, Sport } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import * as db from "./competitions.db.js";
import { requireCommunityPermission } from "../../shared/authorization/community-permissions.js";
import type { CreateCompetitionInput, RegisterCompetitionEntryInput, ReviewCompetitionEntryInput } from "./competitions.validator.js";

const requireMembership = async (communityId: string, userId: string) => {
  const membership = await db.findMembership(communityId, userId);
  if (!membership) throw new AppError("Community not found.", 404);
  return membership;
};

const requireManager = async (communityId: string, userId: string) => {
  await requireCommunityPermission(communityId, userId, "MANAGE_COMPETITIONS", "You do not have permission to manage competitions.");
};

const requireActiveCommunity = async (communityId: string) => {
  const community = await db.findCommunity(communityId);
  if (!community || community.status !== "ACTIVE") throw new AppError("Community not found.", 404);
};

const requireCompetition = async (communityId: string, competitionId: string) => {
  const competition = await db.findCompetition(communityId, competitionId);
  if (!competition) throw new AppError("Competition not found.", 404);
  return competition;
};

export const assertCompetitionSportCompatibility = (sport: Sport, participantType: CompetitionParticipantType) => {
  const capability = getSportCapability(sport);
  if (!capability.competitionSupported) throw new AppError("This sport does not yet have a supported competition adapter.", 409);
  if (capability.participantMode !== participantType) {
    throw new AppError("The selected participant type is not supported by this sport.", 409);
  }
};

export const createCompetition = async (communityId: string, userId: string, input: CreateCompetitionInput) => {
  await requireManager(communityId, userId);
  await requireActiveCommunity(communityId);
  const sport = await db.findCommunitySport(communityId, input.sport as Sport);
  if (!sport) throw new AppError("Enable this sport for the community before creating a competition.", 409);
  assertCompetitionSportCompatibility(sport.sport, input.participantType as CompetitionParticipantType);

  return db.createCompetition({
    communityId,
    communitySportId: sport.id,
    createdById: userId,
    name: input.name,
    format: input.format,
    participantType: input.participantType,
    registrationMode: input.registrationMode,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.maxEntries !== undefined ? { maxEntries: input.maxEntries } : {}),
    ...(input.registrationOpensAt !== undefined ? { registrationOpensAt: input.registrationOpensAt } : {}),
    ...(input.registrationClosesAt !== undefined ? { registrationClosesAt: input.registrationClosesAt } : {}),
    ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
  });
};

export const listCompetitions = async (communityId: string, userId: string) => {
  await requireMembership(communityId, userId);
  await requireActiveCommunity(communityId);
  return db.listCompetitions(communityId);
};

export const getCompetition = async (communityId: string, competitionId: string, userId: string) => {
  await requireMembership(communityId, userId);
  await requireActiveCommunity(communityId);
  return requireCompetition(communityId, competitionId);
};

const allowedTransitions: Readonly<Record<CompetitionStatus, readonly CompetitionStatus[]>> = {
  DRAFT: ["REGISTRATION_OPEN", "CANCELLED"],
  REGISTRATION_OPEN: ["REGISTRATION_CLOSED", "CANCELLED"],
  REGISTRATION_CLOSED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const canTransitionCompetition = (current: CompetitionStatus, next: CompetitionStatus) =>
  next !== "COMPLETED" && (allowedTransitions[current] ?? []).includes(next);

export const transitionCompetition = async (communityId: string, competitionId: string, userId: string, nextStatus: CompetitionStatus) => {
  await requireManager(communityId, userId);
  await requireActiveCommunity(communityId);
  const competition = await requireCompetition(communityId, competitionId);
  if (!canTransitionCompetition(competition.status, nextStatus)) {
    if (nextStatus === "COMPLETED") throw new AppError("A competition can only be completed after fixture and result verification is implemented.", 409);
    throw new AppError(`Competition cannot transition from ${competition.status} to ${nextStatus}.`, 409);
  }
  if (nextStatus === "REGISTRATION_OPEN" && competition.registrationOpensAt && competition.registrationOpensAt > new Date()) {
    throw new AppError("The registration opening time has not been reached.", 409);
  }
  await db.withSerializableTransaction(async (tx) => {
    const current = await tx.competition.findFirst({ where: { id: competitionId, communityId } });
    if (!current || current.status !== competition.status) {
      throw new AppError("Competition status changed concurrently. Refresh and try again.", 409);
    }
    if (nextStatus === "IN_PROGRESS") {
      const approvedCount = await tx.competitionEntry.count({ where: { competitionId, status: "APPROVED" } });
      if (approvedCount < 2) throw new AppError("At least two approved entries are required to start a competition.", 409);
    }
    const updated = await tx.competition.updateMany({
      where: { id: competitionId, communityId, status: current.status },
      data: { status: nextStatus },
    });
    if (updated.count !== 1) throw new AppError("Competition status changed concurrently. Refresh and try again.", 409);
  });
  return db.findCompetition(communityId, competitionId);
};

export const registerEntry = async (communityId: string, competitionId: string, actorId: string, input: RegisterCompetitionEntryInput) => {
  await requireMembership(communityId, actorId);
  await requireActiveCommunity(communityId);
  const competition = await requireCompetition(communityId, competitionId);
  if (competition.status !== "REGISTRATION_OPEN") throw new AppError("This competition is not accepting registrations.", 409);
  if (competition.registrationMode === "INVITE_ONLY") throw new AppError("Invitation-based registration is not available yet.", 409);
  const now = new Date();
  if (competition.registrationOpensAt && competition.registrationOpensAt > now) throw new AppError("Registration has not opened yet.", 409);
  if (competition.registrationClosesAt && competition.registrationClosesAt <= now) throw new AppError("Registration has closed.", 409);

  let teamId: string | null = null;
  let playerUserId: string | null = null;
  let participantNameSnapshot: string;

  if (competition.participantType === "PLAYER") {
    if (input.teamId) throw new AppError("This competition accepts individual players, not teams.", 400);
    const member = await db.findCommunityMember(communityId, actorId);
    if (!member || member.user.status !== "ACTIVE") throw new AppError("An active community member is required.", 409);
    playerUserId = actorId;
    participantNameSnapshot = `${member.user.firstName} ${member.user.lastName}`.trim();
  } else {
    if (!input.teamId) throw new AppError("A team is required for this competition.", 400);
    const team = await db.findTeam(communityId, input.teamId);
    if (!team || team.status !== "ACTIVE" || team.communitySportId !== competition.communitySportId) {
      throw new AppError("An active team registered for this competition's sport is required.", 409);
    }
    const membership = await db.findTeamMembership(team.id, actorId);
    const communityRole = (await db.findMembership(communityId, actorId))?.role;
    if (membership?.role !== "CAPTAIN" && !managerRoles.has(communityRole ?? "")) {
      throw new AppError("Only the team captain or a community manager can register this team.", 403);
    }
    teamId = team.id;
    participantNameSnapshot = team.name;
  }

  const status = competition.registrationMode === "OPEN" ? "APPROVED" : "PENDING";
  try {
    return await db.withSerializableTransaction(async (tx) => {
      const current = await tx.competition.findFirst({ where: { id: competitionId, communityId } });
      if (!current || current.status !== "REGISTRATION_OPEN") throw new AppError("This competition is not accepting registrations.", 409);
      const count = await tx.competitionEntry.count({ where: { competitionId, status: { in: ["PENDING", "APPROVED"] } } });
      if (current.maxEntries !== null && count >= current.maxEntries) throw new AppError("This competition has reached its registration capacity.", 409);
      return tx.competitionEntry.create({
        data: {
          competitionId, communityId, participantType: competition.participantType,
          teamId, playerUserId, status, participantNameSnapshot,
        },
      });
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new AppError("This participant is already registered for the competition.", 409);
    }
    throw error;
  }
};

export const listEntries = async (communityId: string, competitionId: string, userId: string) => {
  await requireMembership(communityId, userId);
  await requireActiveCommunity(communityId);
  await requireCompetition(communityId, competitionId);
  return db.listEntries(communityId, competitionId);
};

export const reviewEntry = async (communityId: string, competitionId: string, entryId: string, actorId: string, input: ReviewCompetitionEntryInput) => {
  await requireManager(communityId, actorId);
  await requireActiveCommunity(communityId);
  const competition = await requireCompetition(communityId, competitionId);
  if (!["REGISTRATION_OPEN", "REGISTRATION_CLOSED"].includes(competition.status)) throw new AppError("Entries can only be reviewed during registration.", 409);
  const entry = await db.findEntry(communityId, competitionId, entryId);
  if (!entry || entry.status !== "PENDING") throw new AppError("Pending competition entry not found.", 404);
  return db.withSerializableTransaction(async (tx) => {
    const currentCompetition = await tx.competition.findFirst({ where: { id: competitionId, communityId } });
    if (!currentCompetition || !["REGISTRATION_OPEN", "REGISTRATION_CLOSED"].includes(currentCompetition.status)) {
      throw new AppError("Entries can only be reviewed during registration.", 409);
    }
    const current = await tx.competitionEntry.findFirst({ where: { id: entryId, communityId, competitionId, status: "PENDING" } });
    if (!current) throw new AppError("Pending competition entry not found.", 404);
    const rejectionReason = input.rejectionReason ?? null;
    if (input.decision === "REJECTED" && !rejectionReason) throw new AppError("A rejection reason is required.", 400);
    const updated = await tx.competitionEntry.updateMany({
      where: { id: entryId, communityId, competitionId, status: "PENDING" },
      data: {
        status: input.decision,
        reviewedAt: new Date(),
        reviewedById: actorId,
        ...(input.decision === "REJECTED" ? { rejectionReason: rejectionReason ?? "Rejected by competition manager." } : { rejectionReason: null }),
      },
    });
    if (updated.count !== 1) throw new AppError("This entry was reviewed concurrently. Refresh and try again.", 409);
    return tx.competitionEntry.findUniqueOrThrow({ where: { id: entryId } });
  });
};

export const withdrawEntry = async (communityId: string, competitionId: string, entryId: string, actorId: string) => {
  const actorMembership = await requireMembership(communityId, actorId);
  await requireActiveCommunity(communityId);
  const competition = await requireCompetition(communityId, competitionId);
  if (["IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(competition.status)) throw new AppError("Entries cannot be withdrawn after the competition starts.", 409);
  const entry = await db.findEntry(communityId, competitionId, entryId);
  if (!entry || !["PENDING", "APPROVED"].includes(entry.status)) throw new AppError("Active competition entry not found.", 404);
  if (entry.participantType === "PLAYER" && entry.playerUserId !== actorId) throw new AppError("You can only withdraw your own player entry.", 403);
  if (entry.participantType === "TEAM") {
    const teamMember = entry.teamId ? await db.findTeamMembership(entry.teamId, actorId) : null;
    if (teamMember?.role !== "CAPTAIN" && !managerRoles.has(actorMembership.role)) throw new AppError("Only the team captain or a community manager can withdraw this entry.", 403);
  }
  return db.withSerializableTransaction(async (tx) => {
    const currentCompetition = await tx.competition.findFirst({ where: { id: competitionId, communityId } });
    if (!currentCompetition || ["IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(currentCompetition.status)) {
      throw new AppError("Entries cannot be withdrawn after the competition starts.", 409);
    }
    const updated = await tx.competitionEntry.updateMany({
      where: { id: entryId, communityId, competitionId, status: { in: ["PENDING", "APPROVED"] } },
      data: { status: "WITHDRAWN" },
    });
    if (updated.count !== 1) throw new AppError("This entry is no longer active.", 409);
  });
};
