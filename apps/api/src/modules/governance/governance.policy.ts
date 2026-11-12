export type ElectionFailureReason = "QUORUM_NOT_MET" | "NO_MAJORITY";

export const resolveElectionOutcome = (
  eligibleVoterCount: number,
  quorumPercent: number,
  votesByCandidate: ReadonlyMap<string, number>,
) => {
  const votesCast = [...votesByCandidate.values()].reduce((total, votes) => total + votes, 0);
  if (votesCast * 100 < eligibleVoterCount * quorumPercent) {
    return { votesCast, winnerCandidateId: null, failureReason: "QUORUM_NOT_MET" as const };
  }

  const highest = Math.max(0, ...votesByCandidate.values());
  const leaders = [...votesByCandidate.entries()].filter(([, votes]) => votes === highest);
  if (votesCast === 0 || leaders.length !== 1 || highest * 2 <= votesCast) {
    return { votesCast, winnerCandidateId: null, failureReason: "NO_MAJORITY" as const };
  }

  return { votesCast, winnerCandidateId: leaders[0]![0], failureReason: null };
};
