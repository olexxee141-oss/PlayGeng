import assert from "node:assert/strict";
import test from "node:test";
import { resolveElectionOutcome } from "./governance.policy.js";

test("quorum is calculated against the frozen eligible electorate", () => {
  const belowQuorum = resolveElectionOutcome(10, 50, new Map([["candidate-a", 4]]));
  assert.equal(belowQuorum.votesCast, 4);
  assert.equal(belowQuorum.winnerCandidateId, null);
  assert.equal(belowQuorum.failureReason, "QUORUM_NOT_MET");

  const exactQuorum = resolveElectionOutcome(10, 50, new Map([["candidate-a", 5]]));
  assert.equal(exactQuorum.winnerCandidateId, "candidate-a");
  assert.equal(exactQuorum.failureReason, null);
});

test("ties and plurality without a strict majority do not appoint an officer", () => {
  const tie = resolveElectionOutcome(4, 50, new Map([["candidate-a", 2], ["candidate-b", 2]]));
  assert.equal(tie.winnerCandidateId, null);
  assert.equal(tie.failureReason, "NO_MAJORITY");

  const plurality = resolveElectionOutcome(5, 50, new Map([["candidate-a", 2], ["candidate-b", 1], ["candidate-c", 1]]));
  assert.equal(plurality.winnerCandidateId, null);
  assert.equal(plurality.failureReason, "NO_MAJORITY");
});

test("a winner must receive more than half of valid ballots", () => {
  const result = resolveElectionOutcome(4, 50, new Map([["candidate-a", 3], ["candidate-b", 1]]));
  assert.equal(result.winnerCandidateId, "candidate-a");
  assert.equal(result.votesCast, 4);
  assert.equal(result.failureReason, null);
});
