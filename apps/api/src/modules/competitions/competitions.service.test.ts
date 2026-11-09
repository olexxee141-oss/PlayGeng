import assert from "node:assert/strict";
import test from "node:test";
import type { CompetitionStatus, CompetitionParticipantType, Sport } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import { assertCompetitionSportCompatibility, canTransitionCompetition } from "./competitions.service.js";

test("competition participant type must match the sport capability", () => {
  assert.doesNotThrow(() => assertCompetitionSportCompatibility("FOOTBALL" as Sport, "TEAM" as CompetitionParticipantType));
  assert.doesNotThrow(() => assertCompetitionSportCompatibility("TENNIS" as Sport, "PLAYER" as CompetitionParticipantType));
  assert.throws(
    () => assertCompetitionSportCompatibility("FOOTBALL" as Sport, "PLAYER" as CompetitionParticipantType),
    (error: unknown) => error instanceof AppError && error.statusCode === 409,
  );
});

test("sports without a competition adapter are rejected", () => {
  assert.throws(
    () => assertCompetitionSportCompatibility("CRICKET" as Sport, "TEAM" as CompetitionParticipantType),
    (error: unknown) => error instanceof AppError && error.statusCode === 409,
  );
  assert.throws(
    () => assertCompetitionSportCompatibility("OTHER" as Sport, "PLAYER" as CompetitionParticipantType),
    (error: unknown) => error instanceof AppError && error.statusCode === 409,
  );
});

test("competition lifecycle rejects skipped and terminal transitions", () => {
  assert.equal(canTransitionCompetition("DRAFT" as CompetitionStatus, "REGISTRATION_OPEN" as CompetitionStatus), true);
  assert.equal(canTransitionCompetition("DRAFT" as CompetitionStatus, "IN_PROGRESS" as CompetitionStatus), false);
  assert.equal(canTransitionCompetition("COMPLETED" as CompetitionStatus, "CANCELLED" as CompetitionStatus), false);
  assert.equal(canTransitionCompetition("IN_PROGRESS" as CompetitionStatus, "COMPLETED" as CompetitionStatus), false);
  assert.equal(canTransitionCompetition("REGISTRATION_OPEN" as CompetitionStatus, "CANCELLED" as CompetitionStatus), true);
});
