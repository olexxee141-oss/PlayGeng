import { AppError } from "../../shared/errors/app-error.js";
import * as db from "./governance.db.js";
import type { CastBallotInput, CreateElectionInput } from "./governance.validator.js";

const isUniqueConflict = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

const ensureElection = async (communityId: string, electionId: string) => {
  const election = await db.syncElection(electionId, new Date());
  if (!election || election.communityId !== communityId) throw new AppError("Election not found.", 404);
  return election;
};

export const createElection = async (communityId: string, userId: string, input: CreateElectionInput) => {
  const now = new Date();
  if (input.nominationsCloseAt <= now) throw new AppError("The nomination closing time must be in the future.", 400);
  if (input.votingOpensAt < input.nominationsCloseAt || input.votingClosesAt <= input.votingOpensAt) {
    throw new AppError("Election dates are invalid.", 400);
  }

  const active = await db.listActiveElections(communityId);
  for (const election of active) await db.syncElection(election.id, now);

  const result = await db.createElection(communityId, userId, input);
  if (result.kind === "COMMUNITY_NOT_FOUND") throw new AppError("Community not found.", 404);
  if (result.kind === "NOT_MEMBER") throw new AppError("Only active community members can create elections.", 403);
  if (result.kind === "ACTIVE_ELECTION_EXISTS") throw new AppError("An election for this office is already active.", 409);
  if (result.kind === "NO_ELIGIBLE_VOTERS") throw new AppError("This community has no eligible voters.", 409);
  return result.election;
};

export const listElections = async (communityId: string, userId: string) => {
  const membership = await db.findMembership(communityId, userId);
  if (!membership || membership.user.status !== "ACTIVE") throw new AppError("Community not found.", 404);
  const elections = await db.listElections(communityId);
  return Promise.all(elections.map((election) => getElection(communityId, election.id, userId)));
};

export const getElection = async (communityId: string, electionId: string, userId: string) => {
  const membership = await db.findMembership(communityId, userId);
  if (!membership || membership.user.status !== "ACTIVE") throw new AppError("Community not found.", 404);
  await ensureElection(communityId, electionId);
  const election = await db.findElection(communityId, electionId);
  if (!election) throw new AppError("Election not found.", 404);
  const voteCounts = election.status === "COMPLETED" || election.status === "FAILED"
    ? await db.countVotesByCandidate(electionId)
    : [];
  const countByNomination = new Map(voteCounts.map((item) => [item.candidateId, item._count._all]));
  return {
    ...election,
    nominations: election.nominations.map((nomination) => ({
      id: nomination.id,
      user: nomination.user,
      createdAt: nomination.createdAt,
      ...(election.status === "COMPLETED" || election.status === "FAILED"
        ? { votes: countByNomination.get(nomination.id) ?? 0 }
        : {}),
    })),
  };
};

export const nominateSelf = async (communityId: string, electionId: string, userId: string) => {
  const election = await ensureElection(communityId, electionId);
  const now = new Date();
  if (election.status !== "NOMINATIONS_OPEN" || now >= election.nominationsCloseAt) {
    throw new AppError("The nomination period is closed.", 409);
  }
  const membership = await db.findMembership(communityId, userId);
  if (!membership || membership.user.status !== "ACTIVE") throw new AppError("Only active community members can nominate themselves.", 403);
  if (membership.role === "CREATOR") throw new AppError("The community creator is not eligible to hold elected offices.", 403);
  if (membership.role !== "MEMBER" && membership.role !== election.role) {
    throw new AppError("A member may hold only one elected office at a time.", 409);
  }
  const eligible = await db.isEligibleVoter(electionId, userId);
  if (!eligible) throw new AppError("You were not a member when this election electorate was recorded.", 403);
  try {
    const result = await db.nominate(communityId, electionId, userId, now);
    if (result.kind === "NOT_FOUND") throw new AppError("Election not found.", 404);
    if (result.kind === "CLOSED") throw new AppError("The nomination period is closed.", 409);
    if (result.kind === "NOT_MEMBER") throw new AppError("Only active community members can nominate themselves.", 403);
    if (result.kind === "CREATOR") throw new AppError("The community creator is not eligible to hold elected offices.", 403);
    if (result.kind === "OTHER_OFFICE") throw new AppError("A member may hold only one elected office at a time.", 409);
    if (result.kind === "NOT_IN_ELECTORATE") throw new AppError("You were not a member when this election electorate was recorded.", 403);
    return result.nomination;
  } catch (error) {
    if (isUniqueConflict(error)) throw new AppError("You have already nominated yourself for this election.", 409);
    throw error;
  }
};

export const withdrawSelfNomination = async (communityId: string, electionId: string, userId: string) => {
  const election = await ensureElection(communityId, electionId);
  if (election.status !== "NOMINATIONS_OPEN" || new Date() >= election.nominationsCloseAt) {
    throw new AppError("The nomination period is closed.", 409);
  }
  const result = await db.withdrawNomination(communityId, electionId, userId, new Date());
  if (result.kind === "NOT_FOUND") throw new AppError("Election not found.", 404);
  if (result.kind === "CLOSED") throw new AppError("The nomination period is closed.", 409);
  if (result.kind === "NOMINATION_NOT_FOUND") throw new AppError("Active nomination not found.", 404);
};

export const castBallot = async (communityId: string, electionId: string, voterId: string, input: CastBallotInput) => {
  const election = await ensureElection(communityId, electionId);
  const now = new Date();
  if (election.status !== "VOTING_OPEN" || now < election.votingOpensAt || now >= election.votingClosesAt) {
    throw new AppError("Voting is not currently open.", 409);
  }
  const eligible = await db.isEligibleVoter(electionId, voterId);
  if (!eligible) throw new AppError("You are not eligible to vote in this election.", 403);
  const membership = await db.findMembership(communityId, voterId);
  if (!membership || membership.user.status !== "ACTIVE") throw new AppError("Only active community members can vote.", 403);
  const candidate = await db.findActiveNomination(electionId, input.candidateId);
  if (!candidate || candidate.user.status !== "ACTIVE") throw new AppError("The selected candidate is not eligible.", 400);
  const candidateMembership = await db.findMembership(communityId, candidate.userId);
  if (!candidateMembership || candidateMembership.role === "CREATOR" || (["ADMIN", "TREASURER", "ORGANIZER"].includes(candidateMembership.role) && candidateMembership.role !== election.role)) throw new AppError("The selected candidate is no longer eligible.", 409);
  try {
    const result = await db.castBallot(communityId, electionId, voterId, input.candidateId, now);
    if (result.kind === "NOT_FOUND") throw new AppError("Election not found.", 404);
    if (result.kind === "CLOSED") throw new AppError("Voting is not currently open.", 409);
    if (result.kind === "NOT_ELIGIBLE") throw new AppError("You are not eligible to vote in this election.", 403);
    if (result.kind === "NOT_MEMBER") throw new AppError("Only active community members can vote.", 403);
    if (result.kind === "INVALID_CANDIDATE") throw new AppError("The selected candidate is not eligible.", 400);
    if (result.kind === "CANDIDATE_INELIGIBLE") throw new AppError("The selected candidate is no longer eligible.", 409);
    return { id: result.ballot.id, electionId: result.ballot.electionId, castAt: result.ballot.castAt };
  } catch (error) {
    if (isUniqueConflict(error)) throw new AppError("You have already voted in this election.", 409);
    throw error;
  }
};


export const processDueElections = async () => {
  const due = await db.listDueElections(new Date());
  for (const election of due) {
    await db.syncElection(election.id, new Date());
  }
  return due.length;
};
