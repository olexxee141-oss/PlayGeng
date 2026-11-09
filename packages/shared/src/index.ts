export type ApiResponse<T> = {
  success: true;
  message: string;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  errors?: Array<{
    field?: string;
    message: string;
  }>;
};

export type HealthStatus = {
  status: "ok";
  timestamp: string;
};

export {
  SPORT_CAPABILITIES,
  getSportCapability,
  validateCompetitionResult,
} from "./sports.js";
export type {
  CompetitionResult,
  ParticipantMode,
  ResultFormat,
  ScoreResult,
  SetsResult,
  SportCapability,
  SportCode,
} from "./sports.js";
