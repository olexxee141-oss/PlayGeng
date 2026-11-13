import { z } from "zod";

const dateTime = z.string().datetime({ offset: true }).transform((value) => new Date(value));

export const createReviewCouncilElectionSchema = z.object({
  nominationsCloseAt: dateTime,
  votingOpensAt: dateTime,
  votingClosesAt: dateTime,
  quorumPercent: z.number().int().min(50).max(100),
}).refine((value) => value.nominationsCloseAt > new Date(), {
  message: "The nomination closing time must be in the future.",
  path: ["nominationsCloseAt"],
}).refine((value) => value.votingOpensAt >= value.nominationsCloseAt, {
  message: "Voting must open after nominations close.",
  path: ["votingOpensAt"],
}).refine((value) => value.votingClosesAt > value.votingOpensAt, {
  message: "Voting must close after it opens.",
  path: ["votingClosesAt"],
});

export const castReviewCouncilBallotSchema = z.object({
  candidateId: z.string().min(1).max(64),
}).strict();

export type CreateReviewCouncilElectionInput = z.infer<typeof createReviewCouncilElectionSchema>;
export type CastReviewCouncilBallotInput = z.infer<typeof castReviewCouncilBallotSchema>;
