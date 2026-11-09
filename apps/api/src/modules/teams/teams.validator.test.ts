import assert from "node:assert/strict";
import test from "node:test";
import {
  addTeamMemberSchema,
  createTeamSchema,
  sportSchema,
  updateTeamSchema,
} from "./teams.validator.js";

test("sport schema accepts supported sports and rejects unknown values", () => {
  assert.equal(sportSchema.parse("FOOTBALL"), "FOOTBALL");
  assert.equal(sportSchema.parse("BASKETBALL"), "BASKETBALL");
  assert.throws(() => sportSchema.parse("FUTSAL"));
});

test("team creation trims fields and requires an enabled sport identifier", () => {
  const parsed = createTeamSchema.parse({
    name: "  Lagos United  ",
    sport: "FOOTBALL",
    shortName: " LU ",
  });

  assert.equal(parsed.name, "Lagos United");
  assert.equal(parsed.shortName, "LU");
  assert.equal(parsed.sport, "FOOTBALL");
  assert.throws(() => createTeamSchema.parse({ name: "A", sport: "FOOTBALL" }));
});

test("team updates allow explicit nullable optional fields", () => {
  assert.deepEqual(updateTeamSchema.parse({ description: null }), { description: null });
  assert.throws(() => updateTeamSchema.parse({ name: "" }));
});

test("team roster role defaults to PLAYER", () => {
  assert.deepEqual(addTeamMemberSchema.parse({ userId: "user_123" }), {
    userId: "user_123",
    role: "PLAYER",
  });
  assert.throws(() => addTeamMemberSchema.parse({ userId: "user_123", role: "OWNER" }));
});
