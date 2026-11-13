import assert from "node:assert/strict";
import test from "node:test";
import { declareAssemblyConflictSchema, decideAssemblyConflictSchema, respondToAssemblyConflictSchema } from "./assembly.conflicts.validator.js";

test("validates confidential conflict declarations and reason bounds", () => {
  assert.equal(declareAssemblyConflictSchema.safeParse({ subjectUserId: "member-1", reason: "There is a direct financial relationship affecting this case decision." }).success, true);
  assert.equal(declareAssemblyConflictSchema.safeParse({ subjectUserId: "member-1", reason: "bad" }).success, false);
  assert.equal(declareAssemblyConflictSchema.safeParse({ subjectUserId: "member-1", reason: "A sufficiently long reason that is okay.", extra: true }).success, false);
});

test("requires a reasoned independent determination and subject response", () => {
  assert.equal(decideAssemblyConflictSchema.safeParse({ conflictExists: true, reason: "I reviewed the declaration and supporting information carefully." }).success, true);
  assert.equal(decideAssemblyConflictSchema.safeParse({ conflictExists: true, reason: "yes" }).success, false);
  assert.equal(respondToAssemblyConflictSchema.safeParse({ response: "I dispute the alleged relationship and provide this explanation." }).success, true);
});
