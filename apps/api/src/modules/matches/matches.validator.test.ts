import assert from "node:assert/strict";
import test from "node:test";
import { createMatchSchema, updateMatchSchema, attendanceSchema } from "./matches.validator.js";

test("match creation accepts a valid scheduled match", () => {
  const result = createMatchSchema.safeParse({
    title: "Sunday football",
    startsAt: "2026-11-15T15:00:00.000Z",
    endsAt: "2026-11-15T17:00:00.000Z",
    capacity: 22,
  });
  assert.equal(result.success, true);
});

test("match creation rejects an end time before its start time", () => {
  const result = createMatchSchema.safeParse({
    title: "Sunday football",
    startsAt: "2026-11-15T17:00:00.000Z",
    endsAt: "2026-11-15T15:00:00.000Z",
  });
  assert.equal(result.success, false);
});

test("match capacity must be null or between 2 and 1000", () => {
  const result = createMatchSchema.safeParse({
    title: "Sunday football",
    startsAt: "2026-11-15T15:00:00.000Z",
    capacity: 1,
  });
  assert.equal(result.success, false);
});

test("match updates reject invalid attendance status values", () => {
  assert.equal(attendanceSchema.safeParse({ status: "NO_SHOW" }).success, true);
  assert.equal(attendanceSchema.safeParse({ status: "WAITLISTED" }).success, false);
});

test("match updates allow clearing an optional end time", () => {
  assert.equal(updateMatchSchema.safeParse({ endsAt: null }).success, true);
});
