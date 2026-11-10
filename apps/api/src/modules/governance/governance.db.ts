import { prisma, type ElectionRole, type Prisma } from "@playgeng/database";
import { resolveElectionOutcome } from "./governance.policy.js";

const isSerializationConflict = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "P2034") return true;
  if ("cause" in error) {
    const cause = error.cause;
    if (typeof cause === "object" && cause !== null && "originalCode" in cause && cause.originalCode === "40001") return true;
    return isSerializationConflict(cause);
  }
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

export const findMembership = (communityId: string, userId: string) =>
  prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    include: { user: { select: { id: true, status: true, firstName: true, lastName: true } } },
  });

export const listActiveElections = (communityId: string) =>
  prisma.communityElection.findMany({
    where: { communityId, status: { in: ["NOMINATIONS_OPEN", "NOMINATIONS_CLOSED", "VOTING_OPEN"] } },
    select: { id: true },
  });

export const createElection = async (
  communityId: string,
  createdById: string,
  input: {
    role: ElectionRole;
    nominationsCloseAt: Date;
    votingOpensAt: Date;
    votingClosesAt: Date;
    quorumPercent: number;
  },
) => withSerializableTransaction(async (tx) => {
  const community = await tx.community.findFirst({
    where: { id: communityId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!community) return { kind: "COMMUNITY_NOT_FOUND" as const };

  const membership = await tx.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId: createdById } },
    include: { user: { select: { status: true } } },
  });
  if (!membership || membership.user.status !== "ACTIVE") return { kind: "NOT_MEMBER" as const };

  const existing = await tx.communityElection.findFirst({
    where: { communityId, role: input.role, status: { in: ["NOMINATIONS_OPEN", "NOMINATIONS_CLOSED", "VOTING_OPEN"] } },
    select: { id: true },
  });
  if (existing) return { kind: "ACTIVE_ELECTION_EXISTS" as const };

  const voters = await tx.communityMember.findMany({
    where: { communityId, user: { status: "ACTIVE" } },
    select: { userId: true },
  });
  if (voters.length === 0) return { kind: "NO_ELIGIBLE_VOTERS" as const };

  const election = await tx.communityElection.create({
    data: {
      communityId,
      createdById,
      ...input,
      eligibleVoterCount: voters.length,
      electorate: { createMany: { data: voters.map((voter) => ({ userId: voter.userId })) } },
    },
  });
  return { kind: "CREATED" as const, election };
});

export const findElection = (communityId: string, electionId: string) =>
  prisma.communityElection.findFirst({
    where: { id: electionId, communityId },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      winner: { select: { id: true, firstName: true, lastName: true } },
      nominations: {
        where: { withdrawnAt: null },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

export const listElections = (communityId: string) =>
  prisma.communityElection.findMany({
    where: { communityId },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      winner: { select: { id: true, firstName: true, lastName: true } },
      nominations: {
        where: { withdrawnAt: null },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

export const syncElection = (electionId: string, now: Date) =>
  withSerializableTransaction(async (tx) => {
    const election = await tx.communityElection.findUnique({
      where: { id: electionId },
      include: {
        nominations: {
          where: { withdrawnAt: null },
          include: { user: { select: { id: true, status: true } } },
        },
      },
    });
    if (!election) return null;

    if (election.status === "NOMINATIONS_OPEN" && now >= election.nominationsCloseAt) {
      if (election.nominations.length === 0) {
        await tx.communityElection.update({
          where: { id: electionId },
          data: { status: "FAILED", failureReason: "NO_CANDIDATES", completedAt: now },
        });
      } else {
        await tx.communityElection.update({
          where: { id: electionId },
          data: { status: "NOMINATIONS_CLOSED" },
        });
      }
    }

    if (now >= election.votingOpensAt && election.nominations.length > 0 && (election.status === "NOMINATIONS_CLOSED" || (election.status === "NOMINATIONS_OPEN" && now >= election.nominationsCloseAt))) {
      await tx.communityElection.update({
        where: { id: electionId },
        data: { status: "VOTING_OPEN" },
      });
    }

    const current = await tx.communityElection.findUnique({
      where: { id: electionId },
      include: {
        nominations: {
          where: { withdrawnAt: null },
          include: { user: { select: { id: true, status: true } } },
        },
      },
    });
    if (!current || current.status !== "VOTING_OPEN" || now < current.votingClosesAt) return current;

    const voteGroups = await tx.electionBallot.groupBy({
      by: ["candidateId"],
      where: { electionId },
      _count: { _all: true },
    });
    const outcome = resolveElectionOutcome(
      current.eligibleVoterCount,
      current.quorumPercent,
      new Map<string, number>(voteGroups.map((group) => [group.candidateId, group._count._all] as const)),
    );
    const { votesCast, failureReason: resultFailureReason } = outcome;
    const winnerNomination = outcome.winnerCandidateId
      ? current.nominations.find((nomination) => nomination.id === outcome.winnerCandidateId)
      : undefined;

    let winnerId: string | null = null;
    let failureReason: string | null = null;

    if (!winnerNomination) {
      failureReason = resultFailureReason ?? "NO_MAJORITY";
    } else {
      const candidateMembership = await tx.communityMember.findUnique({
        where: { communityId_userId: { communityId: current.communityId, userId: winnerNomination.userId } },
        include: { user: { select: { status: true } } },
      });
      const hasConflictingOffice = candidateMembership
        && ["ADMIN", "TREASURER", "ORGANIZER"].includes(candidateMembership.role)
        && candidateMembership.role !== current.role;
      if (!candidateMembership || candidateMembership.user.status !== "ACTIVE" || candidateMembership.role === "CREATOR" || hasConflictingOffice) {
        failureReason = "WINNER_NO_LONGER_ELIGIBLE";
      } else {
        await tx.communityMember.updateMany({
          where: { communityId: current.communityId, role: current.role },
          data: { role: "MEMBER" },
        });
        await tx.communityMember.update({
          where: { communityId_userId: { communityId: current.communityId, userId: winnerNomination.userId } },
          data: { role: current.role },
        });
        winnerId = winnerNomination.userId;
      }
    }

    return tx.communityElection.update({
      where: { id: electionId },
      data: {
        status: winnerId ? "COMPLETED" : "FAILED",
        winnerId,
        failureReason,
        votesCast,
        completedAt: now,
      },
      include: {
        nominations: {
          where: { withdrawnAt: null },
          include: { user: { select: { id: true, status: true } } },
        },
      },
    });
  });

export const nominate = (communityId: string, electionId: string, userId: string, now: Date) =>
  withSerializableTransaction(async (tx) => {
    const election = await tx.communityElection.findFirst({ where: { id: electionId, communityId } });
    if (!election) return { kind: "NOT_FOUND" as const };
    if (election.status !== "NOMINATIONS_OPEN" || now >= election.nominationsCloseAt) return { kind: "CLOSED" as const };
    const membership = await tx.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
      include: { user: { select: { status: true } } },
    });
    if (!membership || membership.user.status !== "ACTIVE") return { kind: "NOT_MEMBER" as const };
    if (membership.role === "CREATOR") return { kind: "CREATOR" as const };
    if (membership.role !== "MEMBER" && membership.role !== election.role) return { kind: "OTHER_OFFICE" as const };
    const eligible = await tx.electionEligibleVoter.findUnique({ where: { electionId_userId: { electionId, userId } } });
    if (!eligible) return { kind: "NOT_IN_ELECTORATE" as const };
    const nomination = await tx.electionNomination.create({ data: { electionId, userId } });
    return { kind: "CREATED" as const, nomination };
  });

export const findNomination = (electionId: string, userId: string) =>
  prisma.electionNomination.findUnique({ where: { electionId_userId: { electionId, userId } } });

export const withdrawNomination = (communityId: string, electionId: string, userId: string, now: Date) =>
  withSerializableTransaction(async (tx) => {
    const election = await tx.communityElection.findFirst({ where: { id: electionId, communityId } });
    if (!election) return { kind: "NOT_FOUND" as const };
    if (election.status !== "NOMINATIONS_OPEN" || now >= election.nominationsCloseAt) return { kind: "CLOSED" as const };
    const nomination = await tx.electionNomination.findUnique({ where: { electionId_userId: { electionId, userId } } });
    if (!nomination || nomination.withdrawnAt) return { kind: "NOMINATION_NOT_FOUND" as const };
    const updated = await tx.electionNomination.update({ where: { id: nomination.id }, data: { withdrawnAt: now } });
    return { kind: "WITHDRAWN" as const, nomination: updated };
  });

export const isEligibleVoter = (electionId: string, userId: string) =>
  prisma.electionEligibleVoter.findUnique({ where: { electionId_userId: { electionId, userId } } });

export const castBallot = (communityId: string, electionId: string, voterId: string, candidateId: string, now: Date) =>
  withSerializableTransaction(async (tx) => {
    const election = await tx.communityElection.findFirst({ where: { id: electionId, communityId } });
    if (!election) return { kind: "NOT_FOUND" as const };
    if (election.status !== "VOTING_OPEN" || now < election.votingOpensAt || now >= election.votingClosesAt) return { kind: "CLOSED" as const };
    const eligible = await tx.electionEligibleVoter.findUnique({ where: { electionId_userId: { electionId, userId: voterId } } });
    if (!eligible) return { kind: "NOT_ELIGIBLE" as const };
    const voter = await tx.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId: voterId } },
      include: { user: { select: { status: true } } },
    });
    if (!voter || voter.user.status !== "ACTIVE") return { kind: "NOT_MEMBER" as const };
    const candidate = await tx.electionNomination.findFirst({
      where: { id: candidateId, electionId, withdrawnAt: null },
      include: { user: { select: { status: true } } },
    });
    if (!candidate || candidate.user.status !== "ACTIVE") return { kind: "INVALID_CANDIDATE" as const };
    const candidateMembership = await tx.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId: candidate.userId } },
    });
    if (!candidateMembership || candidateMembership.role === "CREATOR" ||
      (["ADMIN", "TREASURER", "ORGANIZER"].includes(candidateMembership.role) && candidateMembership.role !== election.role)) {
      return { kind: "CANDIDATE_INELIGIBLE" as const };
    }
    const ballot = await tx.electionBallot.create({ data: { electionId, voterId, candidateId } });
    return { kind: "CAST" as const, ballot };
  });

export const findActiveNomination = (electionId: string, candidateId: string) =>
  prisma.electionNomination.findFirst({
    where: { id: candidateId, electionId, withdrawnAt: null },
    include: { user: { select: { id: true, status: true } } },
  });

export const countVotesByCandidate = (electionId: string) =>
  prisma.electionBallot.groupBy({
    by: ["candidateId"],
    where: { electionId },
    _count: { _all: true },
  });


export const listDueElections = (now: Date) =>
  prisma.communityElection.findMany({
    where: {
      OR: [
        { status: "NOMINATIONS_OPEN", nominationsCloseAt: { lte: now } },
        { status: "NOMINATIONS_CLOSED", votingOpensAt: { lte: now } },
        { status: "VOTING_OPEN", votingClosesAt: { lte: now } },
      ],
    },
    select: { id: true },
  });
