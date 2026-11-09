import assert from "node:assert/strict";
import test from "node:test";
import {
  SPORT_CAPABILITIES,
  getSportCapability,
  validateCompetitionResult,
  type SportCode,
} from "@playgeng/shared";

test("every persisted sport has an explicit capability declaration", () => {
  const persistedSports: SportCode[] = [
    "FOOTBALL", "BASKETBALL", "VOLLEYBALL", "TENNIS", "TABLE_TENNIS",
    "BADMINTON", "CRICKET", "RUGBY", "ESPORTS", "OTHER",
  ];
  assert.deepEqual(Object.keys(SPORT_CAPABILITIES).sort(), [...persistedSports].sort());
});

test("team and individual sports declare the correct participant model", () => {
  assert.equal(getSportCapability("FOOTBALL").participantMode, "TEAM");
  assert.equal(getSportCapability("TENNIS").participantMode, "PLAYER");
  assert.equal(getSportCapability("ESPORTS").participantMode, "EITHER");
});

test("score results reject unsupported formats, invalid numbers and forbidden draws", () => {
  assert.equal(validateCompetitionResult("FOOTBALL", { format: "SCORE", homeScore: 1, awayScore: 1 }), true);
  assert.equal(validateCompetitionResult("BASKETBALL", { format: "SCORE", homeScore: 80, awayScore: 80 }), false);
  assert.equal(validateCompetitionResult("FOOTBALL", { format: "SCORE", homeScore: -1, awayScore: 0 }), false);
  assert.equal(validateCompetitionResult("CRICKET", { format: "SCORE", homeScore: 120, awayScore: 110 }), false);
});

test("set results require a supported sport and non-tied non-negative integer sets", () => {
  assert.equal(validateCompetitionResult("TENNIS", {
    format: "SETS",
    sets: [{ homeScore: 6, awayScore: 4 }, { homeScore: 3, awayScore: 6 }, { homeScore: 7, awayScore: 5 }],
  }), true);
  assert.equal(validateCompetitionResult("VOLLEYBALL", {
    format: "SETS",
    sets: [{ homeScore: 25, awayScore: 25 }],
  }), false);
  assert.equal(validateCompetitionResult("FOOTBALL", {
    format: "SETS",
    sets: [{ homeScore: 1, awayScore: 0 }],
  }), false);
});

test("CUSTOM sports are not competition-enabled until an adapter exists", () => {
  assert.equal(getSportCapability("OTHER").competitionSupported, false);
  assert.equal(validateCompetitionResult("ESPORTS", { format: "SCORE", homeScore: 2, awayScore: 1 }), false);
});
