import assert from "node:assert/strict";
import test from "node:test";
import { resolveConflictDetermination } from "./assembly.conflicts.policy.js";

test("does not determine a conflict from a single reviewer", () => {
  assert.deepEqual(resolveConflictDetermination(["a", "b", "c"], [{ reviewerId: "a", conflictExists: true }]), {
    status: null, votes: 1, eligibleReviewers: 3,
  });
});

test("requires at least two independent votes and a strict majority", () => {
  assert.equal(resolveConflictDetermination(["a", "b", "c"], [
    { reviewerId: "a", conflictExists: true }, { reviewerId: "b", conflictExists: false },
  ]).status, null);
  assert.equal(resolveConflictDetermination(["a", "b", "c"], [
    { reviewerId: "a", conflictExists: true }, { reviewerId: "b", conflictExists: true },
  ]).status, "CONFLICT_CONFIRMED");
  assert.equal(resolveConflictDetermination(["a", "b"], [
    { reviewerId: "a", conflictExists: false }, { reviewerId: "b", conflictExists: false },
  ]).status, "NO_CONFLICT");
});

test("ignores decisions from conflicted or otherwise ineligible reviewers", () => {
  assert.equal(resolveConflictDetermination(["a", "b"], [
    { reviewerId: "a", conflictExists: true },
    { reviewerId: "b", conflictExists: false },
    { reviewerId: "excluded", conflictExists: true },
  ]).status, null);
});
