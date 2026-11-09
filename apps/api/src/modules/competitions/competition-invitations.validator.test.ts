import assert from "node:assert/strict";
import test from "node:test";
import { createCompetitionInvitationSchema } from "./competition-invitations.validator.js";

test("invitation requires exactly one participant identity", () => {
  assert.equal(createCompetitionInvitationSchema.safeParse({ teamId: "team_1" }).success, true);
  assert.equal(createCompetitionInvitationSchema.safeParse({ playerUserId: "user_1" }).success, true);
  assert.equal(createCompetitionInvitationSchema.safeParse({}).success, false);
  assert.equal(createCompetitionInvitationSchema.safeParse({ teamId: "team_1", playerUserId: "user_1" }).success, false);
});

test("invitation expiry must be a valid offset-aware datetime", () => {
  assert.equal(createCompetitionInvitationSchema.safeParse({ playerUserId: "user_1", expiresAt: "2026-11-15T12:00:00.000Z" }).success, true);
  assert.equal(createCompetitionInvitationSchema.safeParse({ playerUserId: "user_1", expiresAt: "tomorrow" }).success, false);
});
