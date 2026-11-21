import assert from "node:assert/strict";
import test from "node:test";
import { quorumRequired, resolveAssemblyOutcome } from "./assembly.voting.policy.js";

test("quorum requires half of the frozen electorate rounded up", () => {
  assert.equal(quorumRequired(1), 1);
  assert.equal(quorumRequired(2), 1);
  assert.equal(quorumRequired(3), 2);
  assert.equal(quorumRequired(5), 3);
});

test("approval requires quorum and a strict YES majority", () => {
  assert.deepEqual(resolveAssemblyOutcome({ eligibleVoterCount: 4, yesVoteCount: 2, noVoteCount: 0 }), {
    quorumRequired: 2, votesCast: 2, quorumReached: true, approved: true, status: "APPROVED",
  });
  assert.equal(resolveAssemblyOutcome({ eligibleVoterCount: 4, yesVoteCount: 1, noVoteCount: 1 }).status, "REJECTED");
  assert.equal(resolveAssemblyOutcome({ eligibleVoterCount: 5, yesVoteCount: 1, noVoteCount: 0 }).quorumReached, false);
});
