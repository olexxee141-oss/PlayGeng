export type SportCode =
  | "FOOTBALL"
  | "BASKETBALL"
  | "VOLLEYBALL"
  | "TENNIS"
  | "TABLE_TENNIS"
  | "BADMINTON"
  | "CRICKET"
  | "RUGBY"
  | "ESPORTS"
  | "OTHER";

export type ParticipantMode = "TEAM" | "PLAYER" | "EITHER";
export type ResultFormat = "SCORE" | "SETS" | "CUSTOM";

export type SportCapability = {
  readonly sport: SportCode;
  readonly participantMode: ParticipantMode;
  readonly resultFormat: ResultFormat;
  readonly drawsAllowed: boolean;
  readonly competitionSupported: boolean;
};

/**
 * Capability declarations are intentionally conservative.
 * CUSTOM means the sport needs a dedicated scoring adapter before results
 * can be accepted or used for standings.
 */
export const SPORT_CAPABILITIES: Readonly<Record<SportCode, SportCapability>> = {
  FOOTBALL: { sport: "FOOTBALL", participantMode: "TEAM", resultFormat: "SCORE", drawsAllowed: true, competitionSupported: true },
  BASKETBALL: { sport: "BASKETBALL", participantMode: "TEAM", resultFormat: "SCORE", drawsAllowed: false, competitionSupported: true },
  VOLLEYBALL: { sport: "VOLLEYBALL", participantMode: "TEAM", resultFormat: "SETS", drawsAllowed: false, competitionSupported: true },
  TENNIS: { sport: "TENNIS", participantMode: "PLAYER", resultFormat: "SETS", drawsAllowed: false, competitionSupported: true },
  TABLE_TENNIS: { sport: "TABLE_TENNIS", participantMode: "PLAYER", resultFormat: "SETS", drawsAllowed: false, competitionSupported: true },
  BADMINTON: { sport: "BADMINTON", participantMode: "PLAYER", resultFormat: "SETS", drawsAllowed: false, competitionSupported: true },
  CRICKET: { sport: "CRICKET", participantMode: "TEAM", resultFormat: "CUSTOM", drawsAllowed: true, competitionSupported: false },
  RUGBY: { sport: "RUGBY", participantMode: "TEAM", resultFormat: "SCORE", drawsAllowed: true, competitionSupported: true },
  ESPORTS: { sport: "ESPORTS", participantMode: "EITHER", resultFormat: "CUSTOM", drawsAllowed: false, competitionSupported: false },
  OTHER: { sport: "OTHER", participantMode: "EITHER", resultFormat: "CUSTOM", drawsAllowed: false, competitionSupported: false },
} as const;

export type ScoreResult = {
  format: "SCORE";
  homeScore: number;
  awayScore: number;
};

export type SetsResult = {
  format: "SETS";
  sets: ReadonlyArray<{ homeScore: number; awayScore: number }>;
};

export type CompetitionResult = ScoreResult | SetsResult;

export function getSportCapability(sport: SportCode): SportCapability {
  return SPORT_CAPABILITIES[sport];
}

/**
 * Checks only the shared result envelope and basic numeric invariants.
 * Sport-specific set victory rules, tiebreaks and standings remain the
 * responsibility of a dedicated sport adapter.
 */
export function validateCompetitionResult(
  sport: SportCode,
  result: CompetitionResult,
): boolean {
  const capability = getSportCapability(sport);
  if (!capability.competitionSupported || capability.resultFormat !== result.format) {
    return false;
  }

  if (result.format === "SCORE") {
    const { homeScore, awayScore } = result;
    if (!Number.isSafeInteger(homeScore) || !Number.isSafeInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      return false;
    }
    return capability.drawsAllowed || homeScore !== awayScore;
  }

  if (result.sets.length === 0 || result.sets.length > 7) return false;
  return result.sets.every(({ homeScore, awayScore }) =>
    Number.isSafeInteger(homeScore) &&
    Number.isSafeInteger(awayScore) &&
    homeScore >= 0 &&
    awayScore >= 0 &&
    homeScore !== awayScore
  );
}
