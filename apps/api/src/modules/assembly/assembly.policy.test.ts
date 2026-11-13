import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSEMBLY_CASE_NOTICE_MINIMUM_HOURS,
  ASSEMBLY_CASE_VOTING_WINDOW_HOURS,
  resolveAssemblyCaseVote,
  validateAssemblyCaseVotingSchedule,
} from "./assembly.policy.js";

const hours = (value: number) => value * 60 * 60 * 1000;

test("case notice must be published at least 48 hours before voting opens", () => {
  const notice = new Date("2026-11-01T00:00:00.000Z");
  const tooSoon = validateAssemblyCaseVotingSchedule(notice, new Date(notice.getTime() + hours(47)), new Date(notice.getTime() + hours(47 + 72)));
  assert.deepEqual(tooSoon, { valid: false, reason: "NOTICE_PERIOD_TOO_SHORT" });

  const exactMinimum = validateAssemblyCaseVotingSchedule(notice, new Date(notice.getTime() + hours(ASSEMBLY_CASE_NOTICE_MINIMUM_HOURS)), new Date(notice.getTime() + hours(48 + ASSEMBLY_CASE_VOTING_WINDOW_HOURS)));
  assert.deepEqual(exactMinimum, { valid: true, reason: null });
});

test("case voting window must be exactly 72 hours", () => {
  const notice = new Date("2026-11-01T00:00:00.000Z");
  const opens = new Date(notice.getTime() + hours(48));
  const tooLong = validateAssemblyCaseVotingSchedule(notice, opens, new Date(opens.getTime() + hours(73)));
  assert.deepEqual(tooLong, { valid: false, reason: "VOTING_WINDOW_MUST_BE_72_HOURS" });

  const exact = validateAssemblyCaseVotingSchedule(notice, opens, new Date(opens.getTime() + hours(ASSEMBLY_CASE_VOTING_WINDOW_HOURS)));
  assert.deepEqual(exact, { valid: true, reason: null });
});

test("quorum is at least 50 percent of the frozen non-recused electorate", () => {
  const below = resolveAssemblyCaseVote(5, 2, 0);
  assert.equal(below.quorumRequired, 3);
  assert.equal(below.outcome, "QUORUM_NOT_MET");

  const exact = resolveAssemblyCaseVote(5, 2, 1);
  assert.equal(exact.quorumMet, true);
  assert.equal(exact.outcome, "APPROVED");
});

test("strict majority is required; ties and no votes are not approved", () => {
  assert.equal(resolveAssemblyCaseVote(4, 2, 2).outcome, "NOT_APPROVED");
  assert.equal(resolveAssemblyCaseVote(4, 1, 3).outcome, "NOT_APPROVED");
  assert.equal(resolveAssemblyCaseVote(4, 0, 4).outcome, "NOT_APPROVED");
});

test("abstentions are excluded from votes cast and cannot satisfy quorum", () => {
  // The frozen electorate is 8; four YES/NO ballots meet quorum. Abstentions are not supplied.
  const result = resolveAssemblyCaseVote(8, 2, 2);
  assert.equal(result.votesCast, 4);
  assert.equal(result.quorumMet, true);
  assert.equal(result.outcome, "NOT_APPROVED");
});

test("invalid electorate and ballot totals are rejected", () => {
  assert.throws(() => resolveAssemblyCaseVote(0, 0, 0), RangeError);
  assert.throws(() => resolveAssemblyCaseVote(3, 2, 2), RangeError);
  assert.throws(() => resolveAssemblyCaseVote(3, -1, 1), RangeError);
});
