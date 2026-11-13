export const ASSEMBLY_CASE_NOTICE_MINIMUM_HOURS = 48;
export const ASSEMBLY_CASE_VOTING_WINDOW_HOURS = 72;
export const ASSEMBLY_CASE_QUORUM_PERCENT = 50;

const HOUR_MS = 60 * 60 * 1000;

export type AssemblyCaseVoteOutcome = "APPROVED" | "NOT_APPROVED" | "QUORUM_NOT_MET";

export type AssemblyCaseVoteResult = {
  eligibleVoterCount: number;
  quorumRequired: number;
  yesVotes: number;
  noVotes: number;
  votesCast: number;
  quorumMet: boolean;
  outcome: AssemblyCaseVoteOutcome;
};

export const validateAssemblyCaseVotingSchedule = (
  noticePublishedAt: Date,
  votingOpensAt: Date,
  votingClosesAt: Date,
) => {
  const noticeTime = noticePublishedAt.getTime();
  const openTime = votingOpensAt.getTime();
  const closeTime = votingClosesAt.getTime();

  if (![noticeTime, openTime, closeTime].every(Number.isFinite)) {
    return { valid: false as const, reason: "INVALID_DATE" as const };
  }

  if (openTime - noticeTime < ASSEMBLY_CASE_NOTICE_MINIMUM_HOURS * HOUR_MS) {
    return { valid: false as const, reason: "NOTICE_PERIOD_TOO_SHORT" as const };
  }

  if (closeTime - openTime !== ASSEMBLY_CASE_VOTING_WINDOW_HOURS * HOUR_MS) {
    return { valid: false as const, reason: "VOTING_WINDOW_MUST_BE_72_HOURS" as const };
  }

  return { valid: true as const, reason: null };
};

/**
 * Resolves a case vote against the electorate frozen after all recusal decisions.
 * Abstentions are intentionally not an input and therefore never count as votes cast.
 * The caller must exclude the requester and all recused members before freezing the
 * electorate and must enforce one ballot per eligible voter at the persistence layer.
 */
export const resolveAssemblyCaseVote = (
  eligibleVoterCount: number,
  yesVotes: number,
  noVotes: number,
): AssemblyCaseVoteResult => {
  for (const [name, value] of Object.entries({ eligibleVoterCount, yesVotes, noVotes })) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`${name} must be a non-negative safe integer.`);
    }
  }

  if (eligibleVoterCount === 0) {
    throw new RangeError("eligibleVoterCount must be greater than zero.");
  }

  const votesCast = yesVotes + noVotes;
  if (votesCast > eligibleVoterCount) {
    throw new RangeError("Valid votes cannot exceed the frozen eligible electorate.");
  }

  const quorumRequired = Math.ceil((eligibleVoterCount * ASSEMBLY_CASE_QUORUM_PERCENT) / 100);
  const quorumMet = votesCast >= quorumRequired;
  const outcome: AssemblyCaseVoteOutcome = !quorumMet
    ? "QUORUM_NOT_MET"
    : yesVotes * 2 > votesCast
      ? "APPROVED"
      : "NOT_APPROVED";

  return {
    eligibleVoterCount,
    quorumRequired,
    yesVotes,
    noVotes,
    votesCast,
    quorumMet,
    outcome,
  };
};
