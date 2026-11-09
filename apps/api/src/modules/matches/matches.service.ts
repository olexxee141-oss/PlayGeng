import { AppError } from "../../shared/errors/app-error.js";
import * as db from "./matches.db.js";
import type { AttendanceInput, CreateMatchInput, UpdateMatchInput } from "./matches.validator.js";

const managerRoles = new Set(["OWNER", "ADMIN", "ORGANIZER"]);

const requireMembership = async (communityId: string, userId: string) => {
  const membership = await db.findMembership(communityId, userId);
  if (!membership) throw new AppError("Community not found.", 404);
  return membership;
};

const requireManager = async (communityId: string, userId: string) => {
  const membership = await requireMembership(communityId, userId);
  if (!managerRoles.has(membership.role)) throw new AppError("You do not have permission to manage matches.", 403);
  return membership;
};

const requireActiveCommunity = async (communityId: string) => {
  const community = await db.findCommunity(communityId);
  if (!community || community.status !== "ACTIVE") throw new AppError("Community not found.", 404);
  return community;
};

export const createMatch = async (communityId: string, userId: string, input: CreateMatchInput) => {
  await requireManager(communityId, userId);
  const community = await requireActiveCommunity(communityId);
  return db.createMatch({
    communityId,
    createdById: userId,
    title: input.title,
    sport: community.sport,
    startsAt: input.startsAt,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.venue !== undefined ? { venue: input.venue } : {}),
    ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
    ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
  });
};

export const listMatches = async (communityId: string, userId: string) => {
  await requireMembership(communityId, userId);
  await requireActiveCommunity(communityId);
  return db.listMatches(communityId);
};

export const getMatch = async (communityId: string, matchId: string, userId: string) => {
  await requireMembership(communityId, userId);
  const match = await db.findMatch(communityId, matchId);
  if (!match) throw new AppError("Match not found.", 404);
  return match;
};

export const updateMatch = async (communityId: string, matchId: string, userId: string, input: UpdateMatchInput) => {
  await requireManager(communityId, userId);
  const current = await db.findMatch(communityId, matchId);
  if (!current) throw new AppError("Match not found.", 404);
  if (current.status !== "SCHEDULED") throw new AppError("Only scheduled matches can be edited.", 409);
  const startsAt = input.startsAt ?? current.startsAt;
  const endsAt = input.endsAt === undefined ? current.endsAt : input.endsAt;
  if (endsAt && endsAt <= startsAt) throw new AppError("End time must be later than start time.", 400);
  if (input.capacity !== undefined && input.capacity !== null) {
    const activeParticipants = await db.countActiveParticipants(matchId);
    if (input.capacity < activeParticipants) {
      throw new AppError("Capacity cannot be lower than the number of confirmed participants.", 409);
    }
  }

  return db.updateMatch(matchId, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.venue !== undefined ? { venue: input.venue } : {}),
    ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
    ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
    ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
  });
};

export const cancelMatch = async (communityId: string, matchId: string, userId: string) => {
  await requireManager(communityId, userId);
  const match = await db.findMatch(communityId, matchId);
  if (!match) throw new AppError("Match not found.", 404);
  if (match.status !== "SCHEDULED") throw new AppError("Only scheduled matches can be cancelled.", 409);
  return db.updateMatch(matchId, { status: "CANCELLED" });
};

export const joinMatch = async (communityId: string, matchId: string, userId: string) => {
  await requireMembership(communityId, userId);
  await requireActiveCommunity(communityId);

  return db.withSerializableTransaction(async (tx) => {
    const match = await tx.match.findFirst({ where: { id: matchId, communityId } });
    if (!match) throw new AppError("Match not found.", 404);
    if (match.status !== "SCHEDULED" || match.startsAt <= new Date()) throw new AppError("This match is no longer accepting participants.", 409);

    const existing = await tx.matchParticipant.findUnique({ where: { matchId_userId: { matchId, userId } } });
    if (existing && !["CANCELLED", "DECLINED"].includes(existing.status)) {
      throw new AppError("You have already responded to this match.", 409);
    }

    const confirmedCount = await tx.matchParticipant.count({
      where: { matchId, status: { in: ["CONFIRMED", "ATTENDED"] } },
    });
    const status = match.capacity !== null && confirmedCount >= match.capacity ? "WAITLISTED" : "CONFIRMED";

    if (existing) {
      return tx.matchParticipant.update({ where: { id: existing.id }, data: { status, joinedAt: new Date() } });
    }
    return tx.matchParticipant.create({ data: { matchId, userId, status } });
  });
};

export const leaveMatch = async (communityId: string, matchId: string, userId: string) => {
  await requireMembership(communityId, userId);
  return db.withSerializableTransaction(async (tx) => {
    const match = await tx.match.findFirst({ where: { id: matchId, communityId } });
    if (!match) throw new AppError("Match not found.", 404);
    if (match.status !== "SCHEDULED") throw new AppError("This match is no longer accepting changes.", 409);

    const participant = await tx.matchParticipant.findUnique({ where: { matchId_userId: { matchId, userId } } });
    if (!participant || !["CONFIRMED", "WAITLISTED"].includes(participant.status)) {
      throw new AppError("You are not an active participant in this match.", 404);
    }
    const updated = await tx.matchParticipant.update({ where: { id: participant.id }, data: { status: "CANCELLED" } });

    if (participant.status === "CONFIRMED") {
      const next = await tx.matchParticipant.findFirst({
        where: { matchId, status: "WAITLISTED" },
        orderBy: { joinedAt: "asc" },
      });
      if (next) await tx.matchParticipant.update({ where: { id: next.id }, data: { status: "CONFIRMED" } });
    }
    return updated;
  });
};

export const recordAttendance = async (communityId: string, matchId: string, actorId: string, userId: string, input: AttendanceInput) => {
  await requireManager(communityId, actorId);
  const match = await db.findMatch(communityId, matchId);
  if (!match) throw new AppError("Match not found.", 404);
  if (match.status !== "SCHEDULED") throw new AppError("Attendance can only be recorded for a scheduled match.", 409);
  return db.withSerializableTransaction(async (tx) => {
    const participant = await tx.matchParticipant.findUnique({ where: { matchId_userId: { matchId, userId } } });
    if (!participant || participant.status !== "CONFIRMED") throw new AppError("Confirmed participant not found.", 404);
    const updated = await tx.matchParticipant.update({ where: { id: participant.id }, data: { status: input.status } });
    if (input.status === "NO_SHOW") {
      const next = await tx.matchParticipant.findFirst({ where: { matchId, status: "WAITLISTED" }, orderBy: { joinedAt: "asc" } });
      if (next) await tx.matchParticipant.update({ where: { id: next.id }, data: { status: "CONFIRMED" } });
    }
    return updated;
  });
};
