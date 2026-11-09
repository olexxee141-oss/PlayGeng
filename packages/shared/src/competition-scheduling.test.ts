import assert from "node:assert/strict";
import test from "node:test";
import {
  generateKnockoutSchedule,
  generateRoundRobinSchedule,
  SchedulingError,
  type SchedulingParticipant,
} from "./competition-scheduling.js";

const participants = (count: number): SchedulingParticipant[] =>
  Array.from({ length: count }, (_, index) => ({
    entryId: `entry-${index + 1}`,
    registeredAt: Date.UTC(2026, 0, index + 1),
  }));

test("round robin generates every unique pair exactly once for an even field", () => {
  const schedule = generateRoundRobinSchedule(participants(6));
  const pairs = schedule.fixtures.filter((fixture) => !fixture.isBye);
  const uniquePairs = new Set(pairs.map((fixture) => [fixture.participantAEntryId, fixture.participantBEntryId].sort().join(":")));

  assert.equal(schedule.roundCount, 5);
  assert.equal(schedule.matchCount, 15);
  assert.equal(schedule.byeCount, 0);
  assert.equal(pairs.length, 15);
  assert.equal(uniquePairs.size, 15);
  for (let round = 1; round <= schedule.roundCount; round += 1) {
    const roundFixtures = pairs.filter((fixture) => fixture.roundNumber === round);
    const played = roundFixtures.flatMap((fixture) => [fixture.participantAEntryId, fixture.participantBEntryId]);
    assert.equal(new Set(played).size, played.length);
  }
});

test("round robin gives each participant exactly one bye in an odd field", () => {
  const schedule = generateRoundRobinSchedule(participants(5));
  const byes = schedule.fixtures.filter((fixture) => fixture.isBye);

  assert.equal(schedule.roundCount, 5);
  assert.equal(schedule.matchCount, 10);
  assert.equal(schedule.byeCount, 5);
  assert.equal(byes.length, 5);
  assert.deepEqual(new Set(byes.map((fixture) => fixture.byeEntryId)).size, 5);
});

test("round robin output is independent of input array order", () => {
  const input = participants(7);
  const first = generateRoundRobinSchedule(input);
  const second = generateRoundRobinSchedule([...input].reverse());
  assert.deepEqual(first.fixtures, second.fixtures);
});

test("knockout uses standard seed positions and awards byes to highest seeds", () => {
  const input = participants(6).map((participant, index) => ({ ...participant, seed: index + 1 }));
  const schedule = generateKnockoutSchedule(input);
  const byes = schedule.fixtures.filter((fixture) => fixture.isBye);

  assert.equal(schedule.bracketSize, 8);
  assert.equal(schedule.roundCount, 3);
  assert.equal(schedule.firstRoundMatchCount, 2);
  assert.equal(schedule.byeCount, 2);
  assert.deepEqual(byes.map((fixture) => fixture.byeEntryId).sort(), ["entry-1", "entry-2"]);
});

test("knockout produces no duplicate or missing first-round participants", () => {
  const schedule = generateKnockoutSchedule(participants(5));
  const participantsInBracket = schedule.fixtures.flatMap((fixture) =>
    fixture.isBye
      ? [fixture.byeEntryId]
      : [fixture.participantAEntryId, fixture.participantBEntryId],
  );

  assert.equal(schedule.bracketSize, 8);
  assert.equal(schedule.byeCount, 3);
  assert.equal(schedule.firstRoundMatchCount, 1);
  assert.equal(new Set(participantsInBracket).size, 5);
  assert.deepEqual(new Set(participantsInBracket), new Set(participants(5).map(({ entryId }) => entryId)));
});

test("scheduler rejects insufficient participants, duplicate entries and duplicate seeds", () => {
  assert.throws(() => generateRoundRobinSchedule(participants(1)), (error) =>
    error instanceof SchedulingError && error.code === "INSUFFICIENT_PARTICIPANTS",
  );
  assert.throws(() => generateRoundRobinSchedule([
    { entryId: "same", registeredAt: 1 },
    { entryId: "same", registeredAt: 2 },
  ]), (error) => error instanceof SchedulingError && error.code === "DUPLICATE_ENTRY");
  assert.throws(() => generateKnockoutSchedule([
    { entryId: "a", registeredAt: 1, seed: 1 },
    { entryId: "b", registeredAt: 2, seed: 1 },
  ]), (error) => error instanceof SchedulingError && error.code === "DUPLICATE_SEED");
});

test("explicit seeds take priority and invalid seeds are rejected", () => {
  const input: SchedulingParticipant[] = [
    { entryId: "late", registeredAt: 1 },
    { entryId: "seed-2", registeredAt: 10, seed: 2 },
    { entryId: "seed-1", registeredAt: 20, seed: 1 },
  ];
  assert.deepEqual(generateKnockoutSchedule(input).orderedEntryIds, ["seed-1", "seed-2", "late"]);
  assert.throws(() => generateRoundRobinSchedule([
    { entryId: "a", registeredAt: 1, seed: 0 },
    { entryId: "b", registeredAt: 2 },
  ]), (error) => error instanceof SchedulingError && error.code === "INVALID_SEED");
});

test("invalid registration timestamps are rejected", () => {
  assert.throws(() => generateRoundRobinSchedule([
    { entryId: "a", registeredAt: "not-a-date" },
    { entryId: "b", registeredAt: 2 },
  ]), (error) => error instanceof SchedulingError && error.code === "INVALID_REGISTRATION_TIME");
});
