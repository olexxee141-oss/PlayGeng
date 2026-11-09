import assert from "node:assert/strict";
import test from "node:test";
import {
  createCompetitionSchema,
  registerCompetitionEntrySchema,
  reviewCompetitionEntrySchema,
  setCompetitionEntrySeedSchema,
  updateCompetitionStatusSchema,
} from "./competitions.validator.js";

test("competition creation accepts supported formats and typed participants", () => {
  const result = createCompetitionSchema.safeParse({
    name: "Community Cup",
    sport: "FOOTBALL",
    format: "KNOCKOUT",
    participantType: "TEAM",
    registrationMode: "APPROVAL_REQUIRED",
    maxEntries: 16,
  });
  assert.equal(result.success, true);
});

test("competition creation rejects invalid registration windows", () => {
  const result = createCompetitionSchema.safeParse({
    name: "Community Cup",
    sport: "FOOTBALL",
    format: "ROUND_ROBIN",
    participantType: "TEAM",
    registrationOpensAt: "2026-11-12T12:00:00.000Z",
    registrationClosesAt: "2026-11-11T12:00:00.000Z",
  });
  assert.equal(result.success, false);
});

test("entry registration rejects polymorphic identity payloads", () => {
  assert.equal(registerCompetitionEntrySchema.safeParse({ teamId: "team_1" }).success, true);
  assert.equal(registerCompetitionEntrySchema.safeParse({ teamId: "team_1", playerUserId: "user_1" }).success, false);
});

test("rejection requires a reason", () => {
  assert.equal(reviewCompetitionEntrySchema.safeParse({ decision: "REJECTED" }).success, false);
  assert.equal(reviewCompetitionEntrySchema.safeParse({ decision: "REJECTED", rejectionReason: "Not eligible" }).success, true);
});

test("status updates accept lifecycle targets only", () => {
  assert.equal(updateCompetitionStatusSchema.safeParse({ status: "REGISTRATION_OPEN" }).success, true);
  assert.equal(updateCompetitionStatusSchema.safeParse({ status: "DRAFT" }).success, false);
});

test("registration must close before the competition starts", () => {
  const result = createCompetitionSchema.safeParse({
    name: "Community Cup",
    sport: "FOOTBALL",
    format: "ROUND_ROBIN",
    participantType: "TEAM",
    registrationClosesAt: "2026-11-15T16:00:00.000Z",
    startsAt: "2026-11-15T15:00:00.000Z",
  });
  assert.equal(result.success, false);
});

test("seed assignment accepts positive integers or an explicit clear", () => {
  assert.equal(setCompetitionEntrySeedSchema.safeParse({ seed: 1 }).success, true);
  assert.equal(setCompetitionEntrySeedSchema.safeParse({ seed: null }).success, true);
  assert.equal(setCompetitionEntrySeedSchema.safeParse({ seed: 0 }).success, false);
  assert.equal(setCompetitionEntrySeedSchema.safeParse({ seed: 1.5 }).success, false);
});
