import { AppError } from "../../shared/errors/app-error.js";
import * as db from "./review-council.db.js";
import type { CastReviewCouncilBallotInput, CreateReviewCouncilElectionInput, ResignReviewCouncilMembershipInput } from "./review-council.validator.js";

const isUniqueConflict = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

const ensureElection = async (communityId: string, electionId: string) => {
  const election = await db.syncElection(electionId, new Date());
  if (!election || election.communityId !== communityId) throw new AppError("Review Council election not found.", 404);
  return election;
};

export const createElection = async (communityId: string, userId: string, input: CreateReviewCouncilElectionInput) => {
  const now = new Date();
  if (input.nominationsCloseAt <= now || input.votingOpensAt < input.nominationsCloseAt || input.votingClosesAt <= input.votingOpensAt) {
    throw new AppError("Election dates are invalid.", 400);
  }
  try {
    const result = await db.createElection(communityId, userId, input);
    if (result.kind === "COMMUNITY_NOT_FOUND") throw new AppError("Community not found.", 404);
    if (result.kind === "NOT_MEMBER") throw new AppError("Only active community members can create Review Council elections.", 403);
    if (result.kind === "COUNCIL_FULL") throw new AppError("All Review Council seats are currently filled.", 409);
    if (result.kind === "ACTIVE_ELECTION_EXISTS") throw new AppError("An election for the next Review Council seat is already active.", 409);
    if (result.kind === "NO_ELIGIBLE_VOTERS") throw new AppError("This community has no eligible voters.", 409);
    return result.election;
  } catch (error) {
    if (isUniqueConflict(error)) throw new AppError("A conflicting Review Council election or membership already exists.", 409);
    throw error;
  }
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
  if (!election) throw new AppError("Review Council election not found.", 404);
  const counts = election.status === "COMPLETED" || election.status === "FAILED"
    ? await db.countVotesByCandidate(electionId)
    : [];
  const byNomination = new Map(counts.map((item) => [item.candidateId, item._count._all]));
  return {
    ...election,
    nominations: election.nominations.map((nomination) => ({
      id: nomination.id,
      user: nomination.user,
      createdAt: nomination.createdAt,
      ...(election.status === "COMPLETED" || election.status === "FAILED"
        ? { votes: byNomination.get(nomination.id) ?? 0 }
        : {}),
    })),
  };
};

export const nominateSelf = async (communityId: string, electionId: string, userId: string) => {
  const election = await ensureElection(communityId, electionId);
  const now = new Date();
  if (election.status !== "NOMINATIONS_OPEN" || now >= election.nominationsCloseAt) throw new AppError("The nomination period is closed.", 409);
  try {
    const result = await db.nominate(communityId, electionId, userId, now);
    if (result.kind === "NOT_FOUND") throw new AppError("Review Council election not found.", 404);
    if (result.kind === "CLOSED") throw new AppError("The nomination period is closed.", 409);
    if (result.kind === "NOT_MEMBER") throw new AppError("Only active community members can nominate themselves.", 403);
    if (result.kind === "EXECUTIVE_OFFICE") throw new AppError("Executive office holders and the creator are not eligible for the Review Council.", 403);
    if (result.kind === "ALREADY_ON_COUNCIL") throw new AppError("An active Review Council member cannot hold another Council seat.", 409);
    if (result.kind === "TERM_LIMIT_REACHED") throw new AppError("You have reached the maximum of two consecutive full Review Council terms.", 409);
    if (result.kind === "NOT_IN_ELECTORATE") throw new AppError("You were not in the electorate snapshot for this election.", 403);
    return result.nomination;
  } catch (error) {
    if (isUniqueConflict(error)) throw new AppError("You have already nominated yourself for this election.", 409);
    throw error;
  }
};

export const withdrawSelfNomination = async (communityId: string, electionId: string, userId: string) => {
  const result = await db.withdrawNomination(communityId, electionId, userId, new Date());
  if (result.kind === "NOT_FOUND") throw new AppError("Review Council election not found.", 404);
  if (result.kind === "CLOSED") throw new AppError("The nomination period is closed.", 409);
  if (result.kind === "NOMINATION_NOT_FOUND") throw new AppError("Active nomination not found.", 404);
};

export const castBallot = async (communityId: string, electionId: string, voterId: string, input: CastReviewCouncilBallotInput) => {
  const election = await ensureElection(communityId, electionId);
  const now = new Date();
  if (election.status !== "VOTING_OPEN" || now < election.votingOpensAt || now >= election.votingClosesAt) throw new AppError("Voting is not currently open.", 409);
  try {
    const result = await db.castBallot(communityId, electionId, voterId, input.candidateId, now);
    if (result.kind === "NOT_FOUND") throw new AppError("Review Council election not found.", 404);
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

export const listMembers = async (communityId: string, userId: string) => {
  const membership = await db.findMembership(communityId, userId);
  if (!membership || membership.user.status !== "ACTIVE") throw new AppError("Community not found.", 404);
  await db.reconcileMembershipLifecycle(communityId, new Date());
  return db.listMembers(communityId);
};

export const listMembershipHistory = async (communityId: string, userId: string) => {
  const membership = await db.findMembership(communityId, userId);
  if (!membership || membership.user.status !== "ACTIVE") throw new AppError("Community not found.", 404);
  await db.reconcileMembershipLifecycle(communityId, new Date());
  return db.listMembershipHistory(communityId);
};

export const resign = async (communityId: string, userId: string, input: ResignReviewCouncilMembershipInput) => {
  const result = await db.resignMembership(communityId, userId, new Date(), input.reason);
  if (result.kind === "COMMUNITY_NOT_FOUND") throw new AppError("Community not found.", 404);
  if (result.kind === "NOT_ACTIVE_MEMBER") throw new AppError("You do not hold an active Review Council seat.", 409);
};

export const processDueElections = async () => {
  const now = new Date();
  const dueMemberships = await db.listDueMemberships(now);
  for (const membership of dueMemberships) await db.reconcileMembershipLifecycle(membership.communityId, now);

  const due = await db.listDueElections(now);
  for (const election of due) await db.syncElection(election.id, now);
  return due.length + dueMemberships.length;
};
