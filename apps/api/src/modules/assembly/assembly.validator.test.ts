import assert from "node:assert/strict";
import test from "node:test";
import { submitAssemblyCaseSchema } from "./assembly.validator.js";

test("accepts a bounded case request with a specific issued-assessment snapshot reference", () => {
  const parsed = submitAssemblyCaseSchema.parse({
    assessmentMemberId: "snapshot_123",
    reason: "I am requesting a review because of a documented change in circumstances.",
  });
  assert.equal(parsed.assessmentMemberId, "snapshot_123");
});

test("rejects short reasons, missing snapshot references, and unexpected fields", () => {
  assert.equal(submitAssemblyCaseSchema.safeParse({ assessmentMemberId: "snapshot_123", reason: "Please help." }).success, false);
  assert.equal(submitAssemblyCaseSchema.safeParse({ reason: "This is a sufficiently long reason for review." }).success, false);
  assert.equal(submitAssemblyCaseSchema.safeParse({
    assessmentMemberId: "snapshot_123",
    reason: "This is a sufficiently long reason for review.",
    status: "APPROVED",
  }).success, false);
});
