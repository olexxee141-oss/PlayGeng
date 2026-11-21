export const quorumRequired = (eligibleVoterCount: number) => Math.ceil(eligibleVoterCount / 2);

export const resolveAssemblyOutcome = (input: {
  eligibleVoterCount: number;
  yesVoteCount: number;
  noVoteCount: number;
}) => {
  const required = quorumRequired(input.eligibleVoterCount);
  const votesCast = input.yesVoteCount + input.noVoteCount;
  const quorumReached = votesCast >= required;
  const approved = quorumReached && input.yesVoteCount > input.noVoteCount;
  return {
    quorumRequired: required,
    votesCast,
    quorumReached,
    approved,
    status: approved ? "APPROVED" as const : "REJECTED" as const,
  };
};
