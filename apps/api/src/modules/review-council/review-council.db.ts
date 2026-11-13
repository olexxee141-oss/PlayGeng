import { prisma, type Prisma } from "@playgeng/database";
import { resolveElectionOutcome } from "./review-council.policy.js";

const isSerializationConflict = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "P2034") return true;
  if ("meta" in error && typeof error.meta === "object" && error.meta !== null &&
    "code" in error.meta && String(error.meta.code) === "40001") return true;
  if ("message" in error && typeof error.message === "string" &&
    /could not serialize access|serialization failure|code:\\s*\\x6040001\\x60/i.test(error.message)) return true;
  if ("cause" in error) return isSerializationConflict(error.cause);
  return false;
};

export const withSerializableTransaction = async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
  throw new Error("Serializable transaction retry limit reached.");
};

const seatForNumber = (seatNumber: number) => ({
  seat: seatNumber <= 3 ? "PRIMARY" as const : "ALTERNATE" as const,
  alternateRank: seatNumber <= 3 ? null : seatNumber - 3,
});

const addOneYear = (date: Date) => {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() + 1);
  return result;
};

export const findMembership = (communityId: string, userId: string) =>
  prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    include: { user: { select: { id: true, status: true, firstName: true, lastName: true } } },
  });

export const createElection = async (
  communityId: string,
  createdById: string,
  input: { nominationsCloseAt: Date; votingOpensAt: Date; votingClosesAt: Date; quorumPercent: number },
) => withSerializableTransaction(async (tx) => {
  const community = await tx.community.findFirst({
    where: { id: communityId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!community) return { kind: "COMMUNITY_NOT_FOUND" as const };

  const creatorMembership = await tx.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId: createdById } },
    include: { user: { select: { status: true } } },
  });
  if (!creatorMembership || creatorMembership.user.status !== "ACTIVE") return { kind: "NOT_MEMBER" as const };

  await reconcileMembershipLifecycleTx(tx, communityId, new Date());

  const activeMembers = await tx.reviewCouncilMember.findMany({
    where: { communityId, status: "ACTIVE" },
    select: { seatNumber: true },
    orderBy: { seatNumber: "asc" },
  });
  const activeSeats = new Set(activeMembers.map((member) => member.seatNumber));
  const seatNumber = [1, 2, 3, 4, 5].find((seat) => !activeSeats.has(seat));
  if (!seatNumber) return { kind: "COUNCIL_FULL" as const };

  const existing = await tx.communityReviewCouncilElection.findFirst({
    where: { communityId, seatNumber, status: { in: ["NOMINATIONS_OPEN", "NOMINATIONS_CLOSED", "VOTING_OPEN"] } },
    select: { id: true },
  });
  if (existing) return { kind: "ACTIVE_ELECTION_EXISTS" as const };

  const voters = await tx.communityMember.findMany({
    where: { communityId, user: { status: "ACTIVE" } },
    select: { userId: true },
  });
  if (voters.length === 0) return { kind: "NO_ELIGIBLE_VOTERS" as const };

  const seat = seatForNumber(seatNumber);
  const election = await tx.communityReviewCouncilElection.create({
    data: {
      communityId,
      createdById,
      seatNumber,
      seat: seat.seat,
      alternateRank: seat.alternateRank,
      ...input,
      eligibleVoterCount: voters.length,
      electorate: { createMany: { data: voters.map((voter) => ({ userId: voter.userId })) } },
    },
  });
  return { kind: "CREATED" as const, election };
});

export const listElections = (communityId: string) =>
  prisma.communityReviewCouncilElection.findMany({
    where: { communityId },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      winner: { select: { id: true, firstName: true, lastName: true } },
      nominations: {
        where: { withdrawnAt: null },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "asc" },
      },
      membership: true,
    },
    orderBy: { createdAt: "desc" },
  });

export const findElection = (communityId: string, electionId: string) =>
  prisma.communityReviewCouncilElection.findFirst({
    where: { id: electionId, communityId },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      winner: { select: { id: true, firstName: true, lastName: true } },
      nominations: {
        where: { withdrawnAt: null },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "asc" },
      },
      membership: true,
    },
  });

export const syncElection = (electionId: string, now: Date) =>
  withSerializableTransaction(async (tx) => {
    const lock = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE "communities" SET "updatedAt" = "updatedAt"
      WHERE "id" = (
        SELECT "communityId" FROM "community_review_council_elections" WHERE "id" = ${electionId}
      )
      RETURNING "id"
    `;
    if (lock.length !== 1) return null;

    const election = await tx.communityReviewCouncilElection.findUnique({
      where: { id: electionId },
      include: { nominations: { where: { withdrawnAt: null }, include: { user: { select: { status: true } } } } },
    });
    if (!election) return null;

    if (election.status === "NOMINATIONS_OPEN" && now >= election.nominationsCloseAt) {
      await tx.communityReviewCouncilElection.update({
        where: { id: electionId },
        data: election.nominations.length === 0
          ? { status: "FAILED", failureReason: "NO_CANDIDATES", completedAt: now }
          : { status: "NOMINATIONS_CLOSED" },
      });
    }

    if (now >= election.votingOpensAt && election.nominations.length > 0 &&
      (election.status === "NOMINATIONS_CLOSED" || (election.status === "NOMINATIONS_OPEN" && now >= election.nominationsCloseAt))) {
      await tx.communityReviewCouncilElection.update({ where: { id: electionId }, data: { status: "VOTING_OPEN" } });
    }

    const current = await tx.communityReviewCouncilElection.findUnique({
      where: { id: electionId },
      include: { nominations: { where: { withdrawnAt: null }, include: { user: { select: { status: true } } } } },
    });
    if (!current || current.status !== "VOTING_OPEN" || now < current.votingClosesAt) return current;

    const voteGroups = await tx.reviewCouncilBallot.groupBy({
      by: ["candidateId"],
      where: { electionId },
      _count: { _all: true },
    });
    const outcome = resolveElectionOutcome(
      current.eligibleVoterCount,
      current.quorumPercent,
      new Map(voteGroups.map((group) => [group.candidateId, group._count._all] as const)),
    );

    const winnerNomination = outcome.winnerCandidateId
      ? current.nominations.find((nomination) => nomination.id === outcome.winnerCandidateId)
      : undefined;

    let winnerId: string | null = null;
    let failureReason: string | null = outcome.failureReason;

    if (winnerNomination) {
      const membership = await tx.communityMember.findUnique({
        where: { communityId_userId: { communityId: current.communityId, userId: winnerNomination.userId } },
        include: { user: { select: { status: true } } },
      });
      const hasExecutiveOffice = membership && ["CREATOR", "ADMIN", "TREASURER", "ORGANIZER"].includes(membership.role);
      const alreadyOnCouncil = await tx.reviewCouncilMember.findFirst({
        where: { communityId: current.communityId, userId: winnerNomination.userId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!membership || membership.user.status !== "ACTIVE" || hasExecutiveOffice || alreadyOnCouncil) {
        failureReason = "WINNER_NO_LONGER_ELIGIBLE";
      } else {
        await tx.reviewCouncilMember.create({
          data: {
            communityId: current.communityId,
            userId: winnerNomination.userId,
            electionId: current.id,
            seatNumber: current.seatNumber,
            seat: current.seat,
            alternateRank: current.alternateRank,
            termStartsAt: now,
            termEndsAt: addOneYear(now),
          },
        });
        winnerId = winnerNomination.userId;
        failureReason = null;
      }
    }

    return tx.communityReviewCouncilElection.update({
      where: { id: electionId },
      data: {
        status: winnerId ? "COMPLETED" : "FAILED",
        winnerId,
        failureReason,
        votesCast: outcome.votesCast,
        completedAt: now,
      },
    });
  });

export const nominate = (communityId: string, electionId: string, userId: string, now: Date) =>
  withSerializableTransaction(async (tx) => {
    const election = await tx.communityReviewCouncilElection.findFirst({ where: { id: electionId, communityId } });
    if (!election) return { kind: "NOT_FOUND" as const };
    if (election.status !== "NOMINATIONS_OPEN" || now >= election.nominationsCloseAt) return { kind: "CLOSED" as const };
    const membership = await tx.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
      include: { user: { select: { status: true } } },
    });
    if (!membership || membership.user.status !== "ACTIVE") return { kind: "NOT_MEMBER" as const };
    if (["CREATOR", "ADMIN", "TREASURER", "ORGANIZER"].includes(membership.role)) return { kind: "EXECUTIVE_OFFICE" as const };
    const alreadyOnCouncil = await tx.reviewCouncilMember.findFirst({
      where: { communityId, userId, status: "ACTIVE" }, select: { id: true },
    });
    if (alreadyOnCouncil) return { kind: "ALREADY_ON_COUNCIL" as const };
    const eligible = await tx.reviewCouncilEligibleVoter.findUnique({ where: { electionId_userId: { electionId, userId } } });
    if (!eligible) return { kind: "NOT_IN_ELECTORATE" as const };
    const nomination = await tx.reviewCouncilNomination.create({ data: { electionId, userId } });
    return { kind: "CREATED" as const, nomination };
  });

export const withdrawNomination = (communityId: string, electionId: string, userId: string, now: Date) =>
  withSerializableTransaction(async (tx) => {
    const election = await tx.communityReviewCouncilElection.findFirst({ where: { id: electionId, communityId } });
    if (!election) return { kind: "NOT_FOUND" as const };
    if (election.status !== "NOMINATIONS_OPEN" || now >= election.nominationsCloseAt) return { kind: "CLOSED" as const };
    const nomination = await tx.reviewCouncilNomination.findUnique({ where: { electionId_userId: { electionId, userId } } });
    if (!nomination || nomination.withdrawnAt) return { kind: "NOMINATION_NOT_FOUND" as const };
    const updated = await tx.reviewCouncilNomination.update({ where: { id: nomination.id }, data: { withdrawnAt: now } });
    return { kind: "WITHDRAWN" as const, nomination: updated };
  });

export const castBallot = (communityId: string, electionId: string, voterId: string, candidateId: string, now: Date) =>
  withSerializableTransaction(async (tx) => {
    const election = await tx.communityReviewCouncilElection.findFirst({ where: { id: electionId, communityId } });
    if (!election) return { kind: "NOT_FOUND" as const };
    if (election.status !== "VOTING_OPEN" || now < election.votingOpensAt || now >= election.votingClosesAt) return { kind: "CLOSED" as const };
    const eligible = await tx.reviewCouncilEligibleVoter.findUnique({ where: { electionId_userId: { electionId, userId: voterId } } });
    if (!eligible) return { kind: "NOT_ELIGIBLE" as const };
    const voter = await tx.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId: voterId } },
      include: { user: { select: { status: true } } },
    });
    if (!voter || voter.user.status !== "ACTIVE") return { kind: "NOT_MEMBER" as const };
    const candidate = await tx.reviewCouncilNomination.findFirst({
      where: { id: candidateId, electionId, withdrawnAt: null },
      include: { user: { select: { status: true } } },
    });
    if (!candidate || candidate.user.status !== "ACTIVE") return { kind: "INVALID_CANDIDATE" as const };
    const candidateMembership = await tx.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId: candidate.userId } },
    });
    const alreadyOnCouncil = await tx.reviewCouncilMember.findFirst({
      where: { communityId, userId: candidate.userId, status: "ACTIVE" }, select: { id: true },
    });
    if (!candidateMembership || ["CREATOR", "ADMIN", "TREASURER", "ORGANIZER"].includes(candidateMembership.role) || alreadyOnCouncil) {
      return { kind: "CANDIDATE_INELIGIBLE" as const };
    }
    const ballot = await tx.reviewCouncilBallot.create({ data: { electionId, voterId, candidateId } });
    return { kind: "CAST" as const, ballot };
  });

export const isEligibleVoter = (electionId: string, userId: string) =>
  prisma.reviewCouncilEligibleVoter.findUnique({ where: { electionId_userId: { electionId, userId } } });

export const findActiveNomination = (electionId: string, candidateId: string) =>
  prisma.reviewCouncilNomination.findFirst({
    where: { id: candidateId, electionId, withdrawnAt: null },
    include: { user: { select: { id: true, status: true } } },
  });

export const countVotesByCandidate = (electionId: string) =>
  prisma.reviewCouncilBallot.groupBy({
    by: ["candidateId"],
    where: { electionId },
    _count: { _all: true },
  });

export const listMembers = (communityId: string) =>
  prisma.reviewCouncilMember.findMany({
    where: { communityId, status: "ACTIVE" },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { seatNumber: "asc" },
  });

const reconcileMembershipLifecycleTx = async (tx: Prisma.TransactionClient, communityId: string, now: Date) => {
  await tx.reviewCouncilMember.updateMany({
    where: { communityId, status: "ACTIVE", termEndsAt: { lte: now } },
    data: { status: "ENDED", endedAt: now, endReason: "TERM_EXPIRED" },
  });

  // Fill any primary vacancy from the highest-ranked active alternate.
  for (const primarySeat of [1, 2, 3]) {
    const occupied = await tx.reviewCouncilMember.findFirst({
      where: { communityId, status: "ACTIVE", seatNumber: primarySeat },
      select: { id: true },
    });
    if (occupied) continue;

    const alternate = await tx.reviewCouncilMember.findFirst({
      where: { communityId, status: "ACTIVE", seat: "ALTERNATE" },
      orderBy: { alternateRank: "asc" },
    });
    if (!alternate) continue;

    await tx.reviewCouncilMember.update({
      where: { id: alternate.id },
      data: { seatNumber: primarySeat, seat: "PRIMARY", alternateRank: null },
    });
  }

  // Compact remaining alternates so rank #1 is always the next successor.
  const alternates = await tx.reviewCouncilMember.findMany({
    where: { communityId, status: "ACTIVE", seat: "ALTERNATE" },
    orderBy: { alternateRank: "asc" },
  });
  for (let index = 0; index < alternates.length; index += 1) {
    const rank = index + 1;
    await tx.reviewCouncilMember.update({
      where: { id: alternates[index].id },
      data: { seatNumber: 3 + rank, alternateRank: rank },
    });
  }
};

export const reconcileMembershipLifecycle = (communityId: string, now: Date) =>
  withSerializableTransaction(async (tx) => {
    const lock = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE "communities" SET "updatedAt" = "updatedAt" WHERE "id" = ${communityId} RETURNING "id"
    `;
    if (lock.length !== 1) return { kind: "NOT_FOUND" as const };
    await reconcileMembershipLifecycleTx(tx, communityId, now);
    return { kind: "RECONCILED" as const };
  });

export const resignMembership = (communityId: string, userId: string, now: Date, reason: string) =>
  withSerializableTransaction(async (tx) => {
    const lock = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE "communities" SET "updatedAt" = "updatedAt" WHERE "id" = ${communityId} RETURNING "id"
    `;
    if (lock.length !== 1) return { kind: "COMMUNITY_NOT_FOUND" as const };

    await reconcileMembershipLifecycleTx(tx, communityId, now);
    const membership = await tx.reviewCouncilMember.findFirst({
      where: { communityId, userId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!membership) return { kind: "NOT_ACTIVE_MEMBER" as const };

    await tx.reviewCouncilMember.update({
      where: { id: membership.id },
      data: { status: "RESIGNED", endedAt: now, endReason: reason },
    });
    await reconcileMembershipLifecycleTx(tx, communityId, now);
    return { kind: "RESIGNED" as const };
  });

export const listMembershipHistory = (communityId: string) =>
  prisma.reviewCouncilMember.findMany({
    where: { communityId },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: [{ status: "asc" }, { seatNumber: "asc" }, { createdAt: "asc" }],
  });

export const listDueMemberships = (now: Date) =>
  prisma.reviewCouncilMember.findMany({
    where: { status: "ACTIVE", termEndsAt: { lte: now } },
    select: { communityId: true },
    distinct: ["communityId"],
  });

export const listDueElections = (now: Date) =>
  prisma.communityReviewCouncilElection.findMany({
    where: {
      OR: [
        { status: "NOMINATIONS_OPEN", nominationsCloseAt: { lte: now } },
        { status: "NOMINATIONS_CLOSED", votingOpensAt: { lte: now } },
        { status: "VOTING_OPEN", votingClosesAt: { lte: now } },
      ],
    },
    select: { id: true },
  });
